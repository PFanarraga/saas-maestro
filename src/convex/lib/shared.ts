// Server-side shared helpers. Re-exports client-safe utilities and adds
// server-only constants (theme presets, plan presets, block definitions).

export * from "../../lib/utils-shared";

import type { ThemeConfig, TemplateKey } from "../../lib/utils-shared";

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

export const PLAN_PRESETS: Record<string, {
  maxProducts: number;
  maxStaff: number;
  maxStorageMb: number;
  customDomain: boolean;
  analytics: boolean;
  coupons: boolean;
  whatsapp: boolean;
  paymentIntegrations: boolean;
  apiAccess: boolean;
}> = {
  FREE: { maxProducts: 10, maxStaff: 1, maxStorageMb: 200, customDomain: false, analytics: false, coupons: false, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  BASIC: { maxProducts: 50, maxStaff: 2, maxStorageMb: 1000, customDomain: false, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  PRO: { maxProducts: 300, maxStaff: 5, maxStorageMb: 5000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: false },
  BUSINESS: { maxProducts: 2000, maxStaff: 15, maxStorageMb: 20000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: true },
  ENTERPRISE: { maxProducts: 100000, maxStaff: 100, maxStorageMb: 100000, customDomain: true, analytics: true, coupons: true, whatsapp: true, paymentIntegrations: true, apiAccess: true },
};

export function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
