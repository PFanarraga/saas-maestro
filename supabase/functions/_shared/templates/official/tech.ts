import { TemplateDefinition } from "../types.ts";

export const tech: TemplateDefinition = {
  metadata: {
    id: "shoply-tech",
    name: "Shoply Tech",
    slug: "tech",
    description: "Diseño futurista y técnico. Ideal para electrónica, componentes de PC y gadgets.",
    category: "technology",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#3b82f6",
      primaryForeground: "#ffffff",
      background: "#0f172a",
      foreground: "#f8fafc",
      card: "#1e293b",
      muted: "#334155",
      mutedForeground: "#94a3b8",
      accent: "#60a5fa",
      border: "#334155",
      radius: "0.5rem"
    },
    typography: { heading: "Inter", body: "Inter" },
    header: { announcement: "Garantía oficial en todos los productos", showWhatsapp: true },
    footer: { text: "Shoply Tech - Innovación a tu alcance" }
  },
  presets: [],
  initialBlocks: [
    { id: "hero-tech", type: "hero", position: 0, settings: { title: "Equípate con lo Mejor", subtitle: "Llevamos la tecnología de vanguardia a tu setup.", ctaLabel: "Ver Novedades", ctaHref: "/products", imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=1200" } },
    { id: "feat-tech", type: "featured_products", position: 1, settings: { title: "Lo más buscado", limit: 6 } }
  ]
};
