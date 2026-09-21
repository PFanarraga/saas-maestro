import { TemplateDefinition } from "../types.ts";

export const classic: TemplateDefinition = {
  metadata: {
    id: "shoply-classic",
    name: "Shoply Classic",
    slug: "classic",
    description: "Estructura tradicional y confiable. Ideal para negocios establecidos que buscan una presencia online sólida.",
    category: "general",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#2563eb",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#1e293b",
      card: "#ffffff",
      muted: "#f1f5f9",
      mutedForeground: "#475569",
      accent: "#3b82f6",
      border: "#cbd5e1",
      radius: "0.25rem"
    },
    typography: { heading: "Arial", body: "Inter" },
    header: { announcement: "Calidad y confianza en cada compra", showWhatsapp: true },
    footer: { text: "© 2026 Shoply Classic" }
  },
  presets: [],
  initialBlocks: [
    { id: "hero-classic", type: "hero", position: 0, settings: { title: "Tu Aliado de Confianza", subtitle: "Amplia variedad de productos con la mejor atención.", ctaLabel: "Ver Catálogo", ctaHref: "/products" } },
    { id: "new-classic", type: "new_products", position: 1, settings: { title: "Recién Llegados", limit: 8 } }
  ]
};
