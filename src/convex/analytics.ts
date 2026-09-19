import { v } from "convex/values";
import { getAccessContext } from "./lib/auth";
import { query } from "./_generated/server";

const PAID_STATUSES = ["paid", "processing", "ready", "shipped", "delivered"];

export const storeDashboard = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return null;
    const tenantId = access.tenantId;
    const now = Date.now();
    const last30 = now - 30 * 24 * 3600 * 1000;

    const orders = await ctx.db.query("orders").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    const events = await ctx.db.query("analyticsEvents").withIndex("by_tenant_type_time", (q) => q.eq("tenantId", tenantId)).collect();
    const products = await ctx.db.query("products").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "active")).collect();
    const customers = await ctx.db.query("customers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();

    const paidOrders = orders.filter((o) => PAID_STATUSES.includes(o.status));
    const revenue = paidOrders.reduce((s, o) => s + o.total, 0);

    const count = (type: string, since?: number) => events.filter((e) => e.type === type && (!since || e.createdAt >= since)).length;

    // Daily revenue series (last 14 days)
    const days: Array<{ day: string; revenue: number; orders: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const start = new Date(now - i * 24 * 3600 * 1000);
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + 24 * 3600 * 1000;
      const dayOrders = paidOrders.filter((o) => o.createdAt >= start.getTime() && o.createdAt < end);
      days.push({
        day: start.toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
        revenue: dayOrders.reduce((s, o) => s + o.total, 0),
        orders: dayOrders.length,
      });
    }

    // Top products by order items
    const topProducts = products.slice(0, 5).map((p) => ({ name: p.name, stock: p.stock, price: p.price }));

    return {
      kpis: {
        revenue,
        orders: orders.length,
        paidOrders: paidOrders.length,
        pendingPayment: orders.filter((o) => o.status === "payment_pending").length,
        products: products.length,
        lowStock: products.filter((p) => p.stock <= 5).length,
        customers: customers.length,
        visitors30d: count("page_view", last30),
        productViews30d: count("product_view", last30),
        addToCart30d: count("add_to_cart", last30),
        checkout30d: count("checkout_started", last30),
        conversionRate: count("page_view", last30) > 0 ? Math.round((paidOrders.length / count("page_view", last30)) * 1000) / 10 : 0,
      },
      funnel: [
        { label: "Visitas", value: count("page_view", last30) },
        { label: "Producto", value: count("product_view", last30) },
        { label: "Carrito", value: count("add_to_cart", last30) },
        { label: "Checkout", value: count("checkout_started", last30) },
        { label: "Pedidos", value: orders.filter((o) => o.createdAt >= last30).length },
        { label: "Ventas", value: paidOrders.filter((o) => o.createdAt >= last30).length },
      ],
      days,
      topProducts,
      tenantStatus: (await ctx.db.get(tenantId))?.status ?? null,
    };
  },
});
