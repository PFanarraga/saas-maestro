"use node";

import { createHmac } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Node-runtime helpers for the payment layer.
 * Webhook signature validation and provider API calls that need Node crypto.
 */
export const verifyWebhookSignature = internalAction({
  args: {
    provider: v.string(),
    rawBody: v.string(),
    timestamp: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { provider, rawBody, timestamp, signature }) => {
    void ctx;
    if (provider !== "culqi") return false;
    const secret = process.env.CULQI_WEBHOOK_SECRET ?? process.env.CULQI_SECRET_KEY ?? "";
    if (!secret || !timestamp || !signature) return false;
    try {
      const expected = createHmac("sha256", secret).update(`${rawBody}${timestamp}`).digest("hex");
      return expected === signature;
    } catch {
      return false;
    }
  },
});

export const createCulqiPaymentLink = internalAction({
  args: {
    orderNumber: v.string(),
    amount: v.number(),
    currency: v.string(),
    tenantId: v.string(),
  },
  handler: async (ctx, { orderNumber, amount, currency, tenantId }) => {
    void ctx;
    const secret = process.env.CULQI_SECRET_KEY;
    if (!secret) throw new Error("CULQI_SECRET_KEY no está configurada");
    const res = await fetch("https://api.culqi.com/v2/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency_code: currency,
        description: `Pedido #${orderNumber}`,
        short_name: `pedido-${orderNumber.toLowerCase()}`,
        installments: 0,
        metadata: { order_number: orderNumber, tenant_id: tenantId },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Culqi error ${res.status}: ${text}`);
    }
    const data: any = await res.json();
    return { providerLinkId: String(data.id), url: String(data.url) };
  },
});
