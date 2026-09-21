import { TemplateDefinition } from "../types.ts";

export const market: TemplateDefinition = {
  metadata: {
    id: "shoply-market",
    name: "Shoply Market",
    slug: "market",
    description: "Estructura eficiente para inventarios grandes. Perfecto para minimarkets y tiendas de conveniencia.",
    category: "market",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog", "search"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#16a34a",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#0f172a",
      card: "#f8fafc",
      muted: "#f0fdf4",
      mutedForeground: "#166534",
      accent: "#22c55e",
      border: "#dcfce7",
      radius: "0.375rem"
    },
    typography: { heading: "Inter", body: "Inter" },
    header: { announcement: "Ofertas del día en frutas y verduras", showWhatsapp: true },
    footer: { text: "Shoply Market - Tu despensa online" }
  },
  presets: [],
  initialBlocks: [
    { id: "hero-market", type: "hero", position: 0, settings: { title: "Tu Compra Semanal", subtitle: "Ahorra tiempo y dinero comprando desde casa.", ctaLabel: "Ver Ofertas", ctaHref: "/products" } },
    { id: "feat-market", type: "featured_products", position: 1, settings: { title: "Imprescindibles", limit: 12 } }
  ]
};
