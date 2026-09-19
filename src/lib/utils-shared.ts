// Client-safe shared helpers (used by both Convex functions and React app)

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

export function formatMoney(amount: number, currency = "PEN"): string {
  const symbols: Record<string, string> = { PEN: "S/", USD: "$", EUR: "€", MXN: "$", CLP: "$", ARS: "$", COP: "$" };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function whatsappLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  payment_pending: "Pago pendiente",
  paid: "Pagado",
  processing: "En proceso",
  ready: "Listo",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  payment_pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-indigo-100 text-indigo-800",
  shipped: "bg-violet-100 text-violet-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-800",
};

export function buildProductInquiryMessage(productName: string, sku?: string, price?: number, currency = "PEN"): string {
  return [
    "Hola, quiero información sobre:",
    "",
    `Producto: ${productName}`,
    sku ? `SKU: ${sku}` : null,
    price !== undefined ? `Precio: ${formatMoney(price, currency)}` : null,
  ].filter(Boolean).join("\n");
}

export function buildOrderInquiryMessage(orderNumber: string): string {
  return `Hola, quiero consultar mi pedido #${orderNumber}.`;
}

export function buildCartMessage(items: Array<{ name: string; quantity: number; variantLabel?: string }>, total: number, currency = "PEN"): string {
  const lines = items.map((i) => `- ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} x${i.quantity}`);
  return ["Hola, quiero comprar:", "", ...lines, "", `Total: ${formatMoney(total, currency)}`].join("\n");
}

export function buildPaymentMessage(orderNumber: string, total: number, paymentUrl: string, currency = "PEN"): string {
  return [
    `Hola, tu pedido #${orderNumber} está pendiente de pago.`,
    "",
    `Total: ${formatMoney(total, currency)}`,
    "",
    "Puedes realizar el pago aquí:",
    paymentUrl,
  ].join("\n");
}

export function isHexColor(value: string | undefined): boolean {
  if (!value) return true;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export function generateToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type ThemeConfig = {
  brand: { name?: string; logoUrl?: string; faviconUrl?: string };
  colors: {
    primary?: string;
    primaryForeground?: string;
    background?: string;
    foreground?: string;
    card?: string;
    muted?: string;
    mutedForeground?: string;
    accent?: string;
    border?: string;
    radius?: string;
  };
  typography: { heading?: string; body?: string };
  header: { announcement?: string; links?: Array<{ label: string; href: string }>; showWhatsapp?: boolean };
  footer: { text?: string; links?: Array<{ label: string; href: string }> };
};

export type PageBlock = {
  id: string;
  type: string;
  position: number;
  hidden?: boolean;
  settings: Record<string, any>;
};

export const STORE_TEMPLATES = {
  minimal: "Minimal",
  vibrant: "Vibrante",
  classic: "Clásica",
} as const;

export type TemplateKey = keyof typeof STORE_TEMPLATES;
