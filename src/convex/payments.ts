import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { action, httpAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireTenantMember } from "./lib/auth";
import { generateToken } from "./lib/shared";

const PAY_PAGE_PATH = "/pay";

/**
 * PaymentService (§19/§20): abstract layer with pluggable providers.
 *  - manual: hosted pay page + confirmation via simulated webhook (dev) or store staff.
 *  - culqi: real Culqi Payment Links API, requires CULQI_SECRET_KEY (server-side only).
 * The rest of the app never talks to a provider directly.
 */

// ---------------------------------------------------------------------------
// Admin: create a payment link for an order (WhatsApp flow §21)
// ---------------------------------------------------------------------------
export const createPaymentLink = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const access = await requireTenantMember(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Pedido no encontrado");
    const tenantId = order.tenantId;
    if (!access.isSuperAdmin && access.tenantId !== tenantId) throw new Error("FORBIDDEN");

    // Idempotent: reuse a pending link for this order
    const existing = await ctx.db.query("paymentLinks").withIndex("by_order", (q) => q.eq("orderId", orderId)).filter((q) => q.eq(q.field("status"), "pending")).first();
    if (existing) return existing;

    const tenant = await ctx.db.get(tenantId);
    const provider = tenant?.paymentProvider ?? "manual";
    const token = generateToken(16);
    const linkId = await ctx.db.insert("paymentLinks", {
      tenantId,
      orderId,
      orderNumber: order.number,
      provider,
      token,
      url: `${PAY_PAGE_PATH}/${token}`,
      amount: order.total,
      currency: order.currency,
      status: "pending",
      expiresAt: Date.now() + 1000 * 60 * 60 * 48, // 48h
      createdAt: Date.now(),
    });
    return await ctx.db.get(linkId);
  },
});

/** Creates a real Culqi payment link for an order (requires CULQI_SECRET_KEY). */
export const createCulqiLink = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<string> => {
    const access = await ctx.runQuery(internal.payments.getAccessForOrder, { orderId });
    if (!access) throw new Error("FORBIDDEN");
    const order = await ctx.runQuery(internal.payments.getOrderForLink, { orderId });
    if (!order) throw new Error("Pedido no encontrado");

    const result = await ctx.runAction(internal.paymentsNode.createCulqiPaymentLink, {
      orderNumber: order.number,
      amount: order.total,
      currency: order.currency,
      tenantId: order.tenantId,
    });
    await ctx.runMutation(api.payments.attachCulqiLink, { orderId, providerLinkId: result.providerLinkId, url: result.url });
    return result.url;
  },
});

export const getAccessForOrder = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const access = await requireTenantMember(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    if (!access.isSuperAdmin && access.tenantId !== order.tenantId) return null;
    return { ok: true };
  },
});

export const getOrderForLink = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    return { number: order.number, total: order.total, currency: order.currency, tenantId: order.tenantId };
  },
});

export const attachCulqiLink = mutation({
  args: { orderId: v.id("orders"), providerLinkId: v.string(), url: v.string() },
  handler: async (ctx, { orderId, providerLinkId, url }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Pedido no encontrado");
    const existing = await ctx.db.query("paymentLinks").withIndex("by_order", (q) => q.eq("orderId", orderId)).filter((q) => q.eq(q.field("status"), "pending")).first();
    if (existing) {
      await ctx.db.patch(existing._id, { provider: "culqi", providerLinkId, url, expiresAt: Date.now() + 1000 * 60 * 60 * 48 });
      return;
    }
    await ctx.db.insert("paymentLinks", {
      tenantId: order.tenantId,
      orderId,
      orderNumber: order.number,
      provider: "culqi",
      providerLinkId,
      token: generateToken(16),
      url,
      amount: order.total,
      currency: order.currency,
      status: "pending",
      expiresAt: Date.now() + 1000 * 60 * 60 * 48,
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Webhook processing (idempotent, §34/§35)
// ---------------------------------------------------------------------------
export const processPaymentEvent = internalMutation({
  args: {
    provider: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    verified: v.boolean(),
    simulated: v.optional(v.boolean()),
    payload: v.optional(v.any()),
    orderNumber: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { provider, eventId, eventType, verified, simulated, payload, orderNumber, amount, currency }) => {
    // Dedupe by (provider, eventId) — never process the same event twice.
    const dupe = await ctx.db.query("paymentEvents").withIndex("by_provider_event", (q) => q.eq("provider", provider).eq("eventId", eventId)).first();
    if (dupe) return { duplicated: true };

    await ctx.db.insert("paymentEvents", {
      provider,
      eventId,
      eventType,
      verified,
      simulated,
      payload,
      processedAt: Date.now(),
    });

    if (!verified || !orderNumber) return { recorded: true };

    const order = await ctx.db.query("orders").withIndex("by_number", (q) => q.eq("number", orderNumber)).first();
    if (!order) return { recorded: true, orderNotFound: true };

    // Amount sanity check
    if (amount !== undefined && Math.abs(amount - order.total) > 0.5) {
      await ctx.db.insert("payments", {
        tenantId: order.tenantId,
        orderId: order._id,
        provider,
        amount,
        currency: currency ?? order.currency,
        status: "failed",
        raw: { reason: "amount_mismatch", expected: order.total, received: amount },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { recorded: true, amountMismatch: true };
    }

    if (order.status === "paid" || order.status === "delivered" || order.status === "refunded") {
      return { recorded: true, alreadyPaid: true };
    }

    await ctx.db.patch(order._id, { status: "paid", updatedAt: Date.now() });
    await ctx.db.insert("orderStatusHistory", { tenantId: order.tenantId, orderId: order._id, fromStatus: order.status, toStatus: "paid", actor: `webhook:${provider}`, createdAt: Date.now() });
    await ctx.db.insert("payments", {
      tenantId: order.tenantId,
      orderId: order._id,
      provider,
      providerPaymentId: eventId,
      amount: amount ?? order.total,
      currency: currency ?? order.currency,
      status: "succeeded",
      raw: payload,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const links = await ctx.db.query("paymentLinks").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect();
    for (const l of links) if (l.status === "pending") await ctx.db.patch(l._id, { status: "paid" });
    await ctx.db.insert("analyticsEvents", { tenantId: order.tenantId, type: "payment_succeeded", value: order.total, createdAt: Date.now() });
    return { recorded: true, orderPaid: true };
  },
});

// ---------------------------------------------------------------------------
// Simulated confirmation (manual provider / dev): validated by link token
// ---------------------------------------------------------------------------
export const simulatePayment = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db.query("paymentLinks").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (!link) throw new Error("Link de pago no válido");
    if (link.status !== "pending") throw new Error("El link ya no está pendiente");
    if (link.expiresAt && link.expiresAt < Date.now()) throw new Error("El link de pago expiró");
    const res: any = await ctx.runMutation(internal.payments.processPaymentEvent, {
      provider: link.provider,
      eventId: `sim_${link.token}`,
      eventType: "payment.succeeded",
      verified: true,
      simulated: true,
      orderNumber: link.orderNumber,
      amount: link.amount,
      currency: link.currency,
    });
    return res;
  },
});

// ---------------------------------------------------------------------------
// HTTP: Culqi webhook endpoint
// ---------------------------------------------------------------------------
export const culqiWebhook = httpAction(async (ctx, request) => {
  const raw = await request.text();
  const signature = request.headers.get("x-culqi-signature") ?? "";
  const timestamp = request.headers.get("x-culqi-timestamp") ?? "";

  let body: any = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
  }

  // Signature validation happens in a Node action (HMAC-SHA256).
  const verified = await ctx.runAction(internal.paymentsNode.verifyWebhookSignature, {
    provider: "culqi",
    rawBody: raw,
    timestamp,
    signature,
  });

  const eventType = body?.type ?? body?.event ?? "unknown";
  const eventId = String(body?.id ?? `${eventType}:${body?.data?.id ?? Date.now()}`);
  const metadata = body?.data?.metadata ?? body?.metadata ?? {};
  const orderNumber = metadata.order_number;
  const amount = body?.data?.amount !== undefined ? body.data.amount / 100 : undefined;

  await ctx.runMutation(internal.payments.processPaymentEvent, {
    provider: "culqi",
    eventId,
    eventType,
    verified,
    payload: body,
    orderNumber,
    amount,
  });
  // Always 200 so the provider doesn't retry on logic errors; duplicates are deduped.
  return new Response(JSON.stringify({ ok: true, verified }), { status: 200 });
});

// ---------------------------------------------------------------------------
// Admin queries
// ---------------------------------------------------------------------------
export const listPaymentEvents = query({
  args: {},
  handler: async (ctx) => {
    await requireTenantMember(ctx);
    return await ctx.db.query("paymentEvents").order("desc").take(100);
  },
});

export const publicPayPage = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db.query("paymentLinks").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (!link) return null;
    const order = await ctx.db.get(link.orderId);
    if (!order) return null;
    const items = await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect();
    const tenant = await ctx.db.get(link.tenantId);
    return {
      orderNumber: order.number,
      amount: order.total,
      currency: order.currency,
      status: link.status,
      provider: link.provider,
      storeName: tenant?.name ?? "",
      items: items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, quantity: i.quantity, total: i.total })),
    };
  },
});
