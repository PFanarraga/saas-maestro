// Port of src/convex/lib/shared.ts server constants.
export const DEFAULT_THEMES: Record<string, any> = {
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

export const PLAN_PRESETS: Record<string, any> = {
  FREE: { maxProducts: 10, maxStaff: 1, maxStorageMb: 200, customDomain: false, analytics: false, coupons: false, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  BASIC: { maxProducts: 50, maxStaff: 2, maxStorageMb: 1000, customDomain: false, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  PRO: { maxProducts: 300, maxStaff: 5, maxStorageMb: 5000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  BUSINESS: { maxProducts: 2000, maxStaff: 15, maxStorageMb: 20000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: true },
  ENTERPRISE: { maxProducts: 100000, maxStaff: 100, maxStorageMb: 100000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: true },
};

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

export const PAID_STATUSES = ["paid", "processing", "ready", "shipped", "delivered"];
