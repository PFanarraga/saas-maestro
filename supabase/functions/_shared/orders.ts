// Port of src/convex/orders.ts, payments.ts, analytics.ts.
import { sql, now, generateOrderNumber, generateToken, BAD_REQUEST, camelize, camelizeAll, type Row } from "./db.ts";
import { audit, getAccessContext, requireTenantMember, resolveTenantId } from "./auth.ts";
import { ORDER_STATUS_LABELS, PAID_STATUSES } from "./constants.ts";

// ---------------------------------------------------------------------------
// Staff/admin queries
// ---------------------------------------------------------------------------
export async function listOrders(req: Request, args: { status?: string }) {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  const tenantId = access.tenantId;
  if (!tenantId) return [];
  const rows = args.status
    ? await sql`select * from public.orders where tenant_id = ${tenantId} and status = ${args.status} order by created_at desc limit 200`
    : await sql`select * from public.orders where tenant_id = ${tenantId} order by created_at desc limit 200`;
  return camelizeAll(rows);
}

export async function getOrder(req: Request, id: string) {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  const rows = await sql`select * from public.orders where id = ${id} limit 1`;
  const order = rows[0];
  if (!order) return null;
  resolveTenantId(access, order.tenant_id);
  const items = await sql`select * from public.order_items where order_id = ${id}`;
  const history = await sql`select * from public.order_status_history where order_id = ${id} order by created_at asc`;
  const payments = await sql`select * from public.payments where order_id = ${id}`;
  const links = await sql`select * from public.payment_links where order_id = ${id}`;
  return {
    ...camelize(order),
    items: camelizeAll(items),
    history: camelizeAll(history),
    payments: camelizeAll(payments),
    paymentLinks: camelizeAll(links),
  };
}

export async function setOrderStatus(req: Request, args: { orderId: string; status: string; note?: string }) {
  const access = await requireTenantMember(req);
  const rows = await sql`select * from public.orders where id = ${args.orderId} limit 1`;
  const order = rows[0];
  if (!order) throw BAD_REQUEST("Pedido no encontrado");
  const tenantId = resolveTenantId(access, order.tenant_id);
  if (!Object.keys(ORDER_STATUS_LABELS).includes(args.status)) throw BAD_REQUEST("Estado inválido");
  await sql`update public.orders set status = ${args.status}, updated_at = ${now()} where id = ${args.orderId}`;
  await sql`
    insert into public.order_status_history (tenant_id, order_id, from_status, to_status, note, actor, created_at)
    values (${tenantId}, ${args.orderId}, ${order.status}, ${args.status}, ${args.note ?? null}, ${access.user.name ?? access.user.email ?? "staff"}, ${now()})
  `;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Checkout (public, guest) — transactional port
// ---------------------------------------------------------------------------
export async function checkout(args: {
  slug: string; sessionKey: string; customerName: string; customerPhone: string; customerEmail?: string;
  deliveryRateId?: string; addressLine1?: string; addressCity?: string; addressRegion?: string;
  addressReference?: string; notes?: string; couponCode?: string; idempotencyKey?: string;
}) {
  return await sql.begin(async (tx: any) => {
    // Idempotency (§35)
    if (args.idempotencyKey) {
      const existing = await tx`select * from public.orders where idempotency_key = ${args.idempotencyKey} limit 1`;
      if (existing[0]) {
        return { orderId: existing[0].id, orderNumber: existing[0].number, alreadyCreated: true };
      }
    }

    const tenants = await tx`select * from public.tenants where slug = ${args.slug} limit 1`;
    const tenant = tenants[0];
    if (!tenant) throw BAD_REQUEST("Tienda no encontrada");
    if (tenant.status === "suspended") throw BAD_REQUEST("Tienda suspendida");
    const tenantId = tenant.id;
    const currency = tenant.currency ?? "PEN";
    const t = now();

    // Cart
    const carts = await tx`select * from public.carts where tenant_id = ${tenantId} and session_key = ${args.sessionKey} limit 1`;
    const cart = carts[0];
    if (!cart) throw BAD_REQUEST("El carrito está vacío");
    const cartItems = await tx`select * from public.cart_items where cart_id = ${cart.id}`;
    if (cartItems.length === 0) throw BAD_REQUEST("El carrito está vacío");

    const itemsTotal = cartItems.reduce((s: number, i: any) => s + Number(i.unit_price) * i.quantity, 0);

    // Coupon
    let discountTotal = 0;
    let appliedCoupon: Row | null = null;
    if (args.couponCode && tenant.coupons_enabled) {
      const code = args.couponCode.toUpperCase().trim();
      const coupons = await tx`select * from public.coupons where tenant_id = ${tenantId} and code = ${code} limit 1`;
      const coupon = coupons[0];
      if (!coupon || !coupon.is_active) throw BAD_REQUEST("Cupón no válido");
      if (coupon.ends_at && coupon.ends_at < t) throw BAD_REQUEST("El cupón ha expirado");
      if (coupon.max_uses !== null && coupon.max_uses !== undefined && coupon.usage_count >= coupon.max_uses) {
        throw BAD_REQUEST("El cupón alcanzó su límite de usos");
      }
      if (coupon.min_amount && itemsTotal < coupon.min_amount) {
        throw BAD_REQUEST(`Monto mínimo para el cupón: ${coupon.min_amount}`);
      }
      discountTotal = coupon.type === "percentage"
        ? Math.round(itemsTotal * (coupon.value / 100) * 100) / 100
        : coupon.type === "fixed_amount"
          ? Math.min(coupon.value, itemsTotal)
          : 0;
      appliedCoupon = coupon;
    }

    // Delivery
    let deliveryTotal = 0;
    let deliveryRate: Row | null = null;
    if (args.deliveryRateId) {
      const rates = await tx`select * from public.delivery_rates where id = ${args.deliveryRateId} limit 1`;
      const rate = rates[0];
      if (!rate || rate.tenant_id !== tenantId || !rate.is_active) throw BAD_REQUEST("Método de entrega no válido");
      if (rate.min_order && itemsTotal < rate.min_order) throw BAD_REQUEST(`Pedido mínimo para ${rate.name}: ${rate.min_order}`);
      deliveryTotal = rate.free_over && itemsTotal - discountTotal >= rate.free_over ? 0 : Number(rate.price);
      if (rate.method !== "pickup" && !args.addressLine1) throw BAD_REQUEST("La dirección es requerida para delivery/envío");
      deliveryRate = rate;
    }

    const total = Math.max(0, Math.round((itemsTotal - discountTotal + deliveryTotal) * 100) / 100);

    // Customer upsert (scoped to tenant)
    let customerId: string | null = null;
    if (args.customerEmail || args.customerPhone) {
      const email = args.customerEmail?.toLowerCase().trim() ?? null;
      let existing: Row | null = null;
      if (email) {
        const r = await tx`select * from public.customers where tenant_id = ${tenantId} and email = ${email} limit 1`;
        existing = r[0] ?? null;
      }
      if (!existing && args.customerPhone) {
        const r = await tx`select * from public.customers where tenant_id = ${tenantId} and phone = ${args.customerPhone} limit 1`;
        existing = r[0] ?? null;
      }
      if (existing) {
        customerId = existing.id;
        await tx`update public.customers set name = ${args.customerName}, total_orders = ${existing.total_orders + 1}, total_spent = ${Number(existing.total_spent) + total} where id = ${existing.id}`;
      } else {
        const r = await tx`
          insert into public.customers (tenant_id, name, email, phone, total_orders, total_spent, created_at)
          values (${tenantId}, ${args.customerName}, ${email}, ${args.customerPhone}, 1, ${total}, ${t}) returning id
        `;
        customerId = r[0].id;
      }
    }

    // Create order + items
    const number = generateOrderNumber();
    const orderRows = await tx`
      insert into public.orders
        (tenant_id, number, customer_id, customer_name, customer_email, customer_phone, status, items_total, discount_total, delivery_total, total, currency, coupon_code, delivery_method, delivery_rate_id, address, notes, idempotency_key, created_at, updated_at)
      values
        (${tenantId}, ${number}, ${customerId}, ${args.customerName.slice(0, 120)}, ${args.customerEmail?.toLowerCase().trim() ?? null}, ${args.customerPhone},
         'payment_pending', ${itemsTotal}, ${discountTotal}, ${deliveryTotal}, ${total}, ${currency},
         ${appliedCoupon?.code ?? null}, ${deliveryRate?.method ?? null}, ${deliveryRate?.id ?? null},
         ${args.addressLine1 ? JSON.stringify({ line1: args.addressLine1.slice(0, 300), city: args.addressCity, region: args.addressRegion, reference: args.addressReference }) : null}::jsonb,
         ${args.notes?.slice(0, 1000) ?? null}, ${args.idempotencyKey ?? null}, ${t}, ${t})
      returning id
    `;
    const orderId = orderRows[0].id;

    for (const item of cartItems) {
      await tx`
        insert into public.order_items (tenant_id, order_id, product_id, variant_id, name, variant_label, unit_price, quantity, total, image_url)
        values (${tenantId}, ${orderId}, ${item.product_id}, ${item.variant_id}, ${item.name}, ${item.variant_label}, ${item.unit_price}, ${item.quantity}, ${Number(item.unit_price) * item.quantity}, ${item.image_url})
      `;
      if (item.variant_id) {
        const vs = await tx`select stock from public.product_variants where id = ${item.variant_id} limit 1`;
        if (vs[0]) await tx`update public.product_variants set stock = greatest(0, ${vs[0].stock - item.quantity}) where id = ${item.variant_id}`;
      } else {
        const ps = await tx`select stock from public.products where id = ${item.product_id} limit 1`;
        if (ps[0]) await tx`update public.products set stock = greatest(0, ${ps[0].stock - item.quantity}), updated_at = ${t} where id = ${item.product_id}`;
      }
      await tx`
        insert into public.inventory_movements (tenant_id, product_id, variant_id, delta, reason, order_id, created_at)
        values (${tenantId}, ${item.product_id}, ${item.variant_id}, ${-item.quantity}, ${`Pedido #${number}`}, ${orderId}, ${t})
      `;
    }

    // Coupon usage
    if (appliedCoupon) {
      await tx`update public.coupons set usage_count = ${appliedCoupon.usage_count + 1} where id = ${appliedCoupon.id}`;
      await tx`
        insert into public.coupon_usages (tenant_id, coupon_id, order_id, customer_email, amount, created_at)
        values (${tenantId}, ${appliedCoupon.id}, ${orderId}, ${args.customerEmail?.toLowerCase() ?? null}, ${discountTotal}, ${t})
      `;
    }

    // History + analytics
    await tx`insert into public.order_status_history (tenant_id, order_id, to_status, actor, created_at)
      values (${tenantId}, ${orderId}, 'payment_pending', 'checkout', ${t})`;
    await tx`insert into public.analytics_events (tenant_id, type, value, created_at)
      values (${tenantId}, 'order_created', ${total}, ${t})`;

    // Clear cart
    await tx`delete from public.cart_items where cart_id = ${cart.id}`;

    return { orderId, orderNumber: number, alreadyCreated: false };
  });
}

// ---------------------------------------------------------------------------
// Public order lookup (by number + phone)
// ---------------------------------------------------------------------------
export async function lookupPublicOrder(args: { slug: string; number: string; phone: string }) {
  const tenants = await sql`select * from public.tenants where slug = ${args.slug} limit 1`;
  const tenant = tenants[0];
  if (!tenant) return null;
  const orders = await sql`
    select * from public.orders where tenant_id = ${tenant.id} and number = ${args.number.toUpperCase().trim()} limit 1
  `;
  const order = orders[0];
  if (!order) return null;
  const digits = (s: string) => s.replace(/[^0-9]/g, "");
  if (digits(order.customer_phone) !== digits(args.phone)) return null;
  const items = await sql`select name, variant_label, quantity, total from public.order_items where order_id = ${order.id}`;
  const links = await sql`select url from public.payment_links where order_id = ${order.id} and status = 'pending' limit 1`;
  return {
    number: order.number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    total: Number(order.total),
    currency: order.currency,
    items: items.map((i: any) => ({ name: i.name, variantLabel: i.variant_label ?? null, quantity: i.quantity, total: Number(i.total) })),
    paymentUrl: links[0]?.url ?? null,
    createdAt: order.created_at,
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export async function createPaymentLink(req: Request, orderId: string) {
  const access = await requireTenantMember(req);
  const orders = await sql`select * from public.orders where id = ${orderId} limit 1`;
  const order = orders[0];
  if (!order) throw BAD_REQUEST("Pedido no encontrado");
  const tenantId = order.tenant_id;
  if (!access.isSuperAdmin && access.tenantId !== tenantId) throw BAD_REQUEST("FORBIDDEN");

  const existing = await sql`select * from public.payment_links where order_id = ${orderId} and status = 'pending' limit 1`;
  if (existing[0]) return camelize(existing[0]);

  const tenants = await sql`select payment_provider from public.tenants where id = ${tenantId} limit 1`;
  const provider = tenants[0]?.payment_provider ?? "manual";
  const token = generateToken(16);
  const created = await sql`
    insert into public.payment_links (tenant_id, order_id, order_number, provider, token, url, amount, currency, status, expires_at, created_at)
    values (${tenantId}, ${orderId}, ${order.number}, ${provider}, ${token}, ${`/pay/${token}`}, ${order.total}, ${order.currency}, 'pending', ${now() + 172_800_000}, ${now()})
    returning *
  `;
  return camelize(created[0]);
}

export async function processPaymentEvent(args: {
  provider: string; eventId: string; eventType: string; verified: boolean; simulated?: boolean;
  payload?: unknown; orderNumber?: string; amount?: number; currency?: string;
}) {
  return await sql.begin(async (tx: any) => {
    const dupe = await tx`select 1 from public.payment_events where provider = ${args.provider} and event_id = ${args.eventId} limit 1`;
    if (dupe[0]) return { duplicated: true };

    await tx`
      insert into public.payment_events (provider, event_id, event_type, verified, simulated, payload, processed_at)
      values (${args.provider}, ${args.eventId}, ${args.eventType}, ${args.verified}, ${args.simulated ?? false},
              ${args.payload === undefined ? null : JSON.stringify(args.payload)}::jsonb, ${now()})
    `;

    if (!args.verified || !args.orderNumber) return { recorded: true };

    const orders = await tx`select * from public.orders where number = ${args.orderNumber} limit 1`;
    const order = orders[0];
    if (!order) return { recorded: true, orderNotFound: true };

    if (args.amount !== undefined && Math.abs(args.amount - Number(order.total)) > 0.5) {
      await tx`
        insert into public.payments (tenant_id, order_id, provider, amount, currency, status, raw, created_at, updated_at)
        values (${order.tenant_id}, ${order.id}, ${args.provider}, ${args.amount}, ${args.currency ?? order.currency}, 'failed',
                ${JSON.stringify({ reason: "amount_mismatch", expected: order.total, received: args.amount })}::jsonb, ${now()}, ${now()})
      `;
      return { recorded: true, amountMismatch: true };
    }

    if (["paid", "delivered", "refunded"].includes(order.status)) {
      return { recorded: true, alreadyPaid: true };
    }

    await tx`update public.orders set status = 'paid', updated_at = ${now()} where id = ${order.id}`;
    await tx`
      insert into public.order_status_history (tenant_id, order_id, from_status, to_status, actor, created_at)
      values (${order.tenant_id}, ${order.id}, ${order.status}, 'paid', ${`webhook:${args.provider}`}, ${now()})
    `;
    await tx`
      insert into public.payments (tenant_id, order_id, provider, provider_payment_id, amount, currency, status, raw, created_at, updated_at)
      values (${order.tenant_id}, ${order.id}, ${args.provider}, ${args.eventId}, ${args.amount ?? order.total}, ${args.currency ?? order.currency}, 'succeeded',
              ${args.payload === undefined ? null : JSON.stringify(args.payload)}::jsonb, ${now()}, ${now()})
    `;
    await tx`update public.payment_links set status = 'paid' where order_id = ${order.id} and status = 'pending'`;
    await tx`insert into public.analytics_events (tenant_id, type, value, created_at)
      values (${order.tenant_id}, 'payment_succeeded', ${order.total}, ${now()})`;
    return { recorded: true, orderPaid: true };
  });
}

export async function simulatePayment(args: { token: string }) {
  const links = await sql`select * from public.payment_links where token = ${args.token} limit 1`;
  const link = links[0];
  if (!link) throw BAD_REQUEST("Link de pago no válido");
  if (link.status !== "pending") throw BAD_REQUEST("El link ya no está pendiente");
  if (link.expires_at && link.expires_at < now()) throw BAD_REQUEST("El link de pago expiró");
  return await processPaymentEvent({
    provider: link.provider,
    eventId: `sim_${link.token}`,
    eventType: "payment.succeeded",
    verified: true,
    simulated: true,
    orderNumber: link.order_number,
    amount: Number(link.amount),
    currency: link.currency,
  });
}

export async function publicPayPage(args: { token: string }) {
  const links = await sql`select * from public.payment_links where token = ${args.token} limit 1`;
  const link = links[0];
  if (!link) return null;
  const orders = await sql`select * from public.orders where id = ${link.order_id} limit 1`;
  const order = orders[0];
  if (!order) return null;
  const items = await sql`select name, variant_label, quantity, total from public.order_items where order_id = ${order.id}`;
  const tenants = await sql`select name from public.tenants where id = ${link.tenant_id} limit 1`;
  return {
    orderNumber: order.number,
    amount: Number(order.total),
    currency: order.currency,
    status: link.status,
    provider: link.provider,
    storeName: tenants[0]?.name ?? "",
    items: items.map((i: any) => ({ name: i.name, variantLabel: i.variant_label ?? null, quantity: i.quantity, total: Number(i.total) })),
  };
}

export async function listPaymentEvents(req: Request) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) return [];
  const rows = await sql`select * from public.payment_events where tenant_id = ${access.tenantId} order by processed_at desc limit 200`;
  return camelizeAll(rows);
}

// ---------------------------------------------------------------------------
// Analytics dashboard
// ---------------------------------------------------------------------------
export async function storeDashboard(req: Request) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return null;
  const tenantId = access.tenantId;
  const t = now();
  const last30 = t - 30 * 86_400_000;

  const orders = await sql`select * from public.orders where tenant_id = ${tenantId}`;
  const events = await sql`select type, created_at from public.analytics_events where tenant_id = ${tenantId} and created_at >= ${last30}`;
  const products = await sql`select * from public.products where tenant_id = ${tenantId} and status = 'active'`;
  const customers = await sql`select count(*)::int as n from public.customers where tenant_id = ${tenantId}`;
  const tenantRow = await sql`select status from public.tenants where id = ${tenantId} limit 1`;

  const paidOrders = orders.filter((o: any) => PAID_STATUSES.includes(o.status));
  const revenue = paidOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
  const count = (type: string) => events.filter((e: any) => e.type === type).length;

  const days: Array<{ day: string; revenue: number; orders: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(t - i * 86_400_000);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 86_400_000;
    const dayOrders = paidOrders.filter((o: any) => o.created_at >= start.getTime() && o.created_at < end);
    days.push({
      day: start.toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
      revenue: dayOrders.reduce((s: number, o: any) => s + Number(o.total), 0),
      orders: dayOrders.length,
    });
  }

  const topProducts = products.slice(0, 5).map((p: any) => ({ name: p.name, stock: p.stock, price: Number(p.price) }));

  return {
    kpis: {
      revenue,
      orders: orders.length,
      paidOrders: paidOrders.length,
      pendingPayment: orders.filter((o: any) => o.status === "payment_pending").length,
      products: products.length,
      lowStock: products.filter((p: any) => p.stock <= 5).length,
      customers: customers[0]?.n ?? 0,
      visitors30d: count("page_view"),
      productViews30d: count("product_view"),
      addToCart30d: count("add_to_cart"),
      checkout30d: count("checkout_started"),
      conversionRate: count("page_view") > 0 ? Math.round((paidOrders.length / count("page_view")) * 1000) / 10 : 0,
    },
    funnel: [
      { label: "Visitas", value: count("page_view") },
      { label: "Producto", value: count("product_view") },
      { label: "Carrito", value: count("add_to_cart") },
      { label: "Checkout", value: count("checkout_started") },
      { label: "Pedidos", value: orders.filter((o: any) => o.created_at >= last30).length },
      { label: "Ventas", value: paidOrders.filter((o: any) => o.created_at >= last30).length },
    ],
    days,
    topProducts,
    tenantStatus: tenantRow[0]?.status ?? null,
  };
}

export { audit };
