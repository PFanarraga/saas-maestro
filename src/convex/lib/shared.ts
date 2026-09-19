import { Doc, Id } from "../_generated/dataModel";

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
  const symbol = symbols[currency] ?? currency + " ";
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

/** Builds a product inquiry WhatsApp message (per prompt §23). */
export function buildProductInquiryMessage(productName: string, sku?: string, price?: number, currency = "PEN"): string {
  return [
    "Hola, quiero información sobre:",
    "",
    `Producto: ${productName}`,
    sku ? `SKU: ${sku}` : null,
    price !== undefined ? `Precio: ${formatMoney(price, currency)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Builds an order inquiry WhatsApp message (per prompt §23). */
export function buildOrderInquiryMessage(orderNumber: string): string {
  return `Hola, quiero consultar mi pedido #${orderNumber}.`;
}

/** Builds a cart purchase WhatsApp message (per prompt §23). */
export function buildCartMessage(items: Array<{ name: string; quantity: number; variantLabel?: string }>, total: number, currency = "PEN"): string {
  const lines = items.map(
    (i) => `- ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} x${i.quantity}`,
  );
  return ["Hola, quiero comprar:", "", ...lines, "", `Total: ${formatMoney(total, currency)}`].join("\n");
}

/** Builds a payment-link WhatsApp message (per prompt §23/§21). */
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

export type ThemeConfig = Doc<"tenantThemes">["theme"];

/** Validates a hex color string. */
export function isHexColor(value: string | undefined): boolean {
  if (!value) return true; // undefined is allowed (fallback)
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function generateToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const STORE_TEMPLATES = {
  minimal: "Minimal",
  vibrant: "Vibrante",
  classic: "Clásica",
} as const;

export type TemplateKey = keyof typeof STORE_TEMPLATES;

export const DEFAULT_THEMES: Record<TemplateKey, ThemeConfig> = {
  minimal: {
    brand: {},
    colors: {
      primary: "#111111",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#111111",
      card: "#fafafa",
      muted: "#f5f5f5",
      mutedForeground: "#6b7280",
      accent: "#111111",
      border: "#e5e7eb",
      radius: "0.5rem",
    },
    typography: { heading: "Inter", body: "Inter" },
    header: {},
    footer: {},
  },
  vibrant: {
    brand: {},
    colors: {
      primary: "#7c3aed",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#1e1b4b",
      card: "#f5f3ff",
      muted: "#ede9fe",
      mutedForeground: "#6d28d9",
      accent: "#ec4899",
      border: "#ddd6fe",
      radius: "1rem",
    },
    typography: { heading: "Poppins", body: "Inter" },
    header: {},
    footer: {},
  },
  classic: {
    brand: {},
    colors: {
      primary: "#0f766e",
      primaryForeground: "#ffffff",
      background: "#fbfdfb",
      foreground: "#134e4a",
      card: "#f0fdfa",
      muted: "#ccfbf1",
      mutedForeground: "#0f766e",
      accent: "#f59e0b",
      border: "#99f6e4",
      radius: "0.375rem",
    },
    typography: { heading: "Georgia", body: "Inter" },
    header: {},
    footer: {},
  },
};

export const DEFAULT_HOMEPAGE_BLOCKS = [
  {
    id: "hero",
    type: "hero",
    position: 0,
    settings: {
      title: "Bienvenido a tu tienda",
      subtitle: "Descubre nuestros productos y compra fácil por WhatsApp o en línea.",
      ctaLabel: "Ver productos",
      ctaHref: "#products",
      imageUrl: "",
      align: "center",
    },
  },
  {
    id: "featured",
    type: "featured_products",
    position: 1,
    settings: { title: "Productos destacados", limit: 8 },
  },
  {
    id: "categories",
    type: "categories",
    position: 2,
    settings: { title: "Categorías" },
  },
  {
    id: "text",
    type: "text",
    position: 3,
    settings: { title: "Sobre nosotros", body: "Escribe aquí la historia de tu tienda." },
  },
] as const;

export const BLOCK_TYPES = [
  { type: "hero", label: "Hero" },
  { type: "banner", label: "Banner" },
  { type: "categories", label: "Categorías" },
  { type: "featured_products", label: "Productos destacados" },
  { type: "new_products", label: "Productos nuevos" },
  { type: "text", label: "Texto" },
  { type: "image", label: "Imagen" },
  { type: "video", label: "Video" },
  { type: "testimonials", label: "Testimonios" },
  { type: "faq", label: "FAQ" },
  { type: "newsletter", label: "Newsletter" },
  { type: "spacer", label: "Espaciador" },
] as const;

export const PLAN_PRESETS = {
  FREE: { maxProducts: 10, maxStaff: 1, maxStorageMb: 200, customDomain: false, analytics: false, coupons: false, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  BASIC: { maxProducts: 50, maxStaff: 2, maxStorageMb: 1000, customDomain: false, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  PRO: { maxProducts: 300, maxStaff: 5, maxStorageMb: 5000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  BUSINESS: { maxProducts: 2000, maxStaff: 15, maxStorageMb: 20000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: true },
  ENTERPRISE: { maxProducts: 100000, maxStaff: 100, maxStorageMb: 100000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: true },
} as const;
