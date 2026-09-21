import { TemplateDefinition } from "../types";

export const minimal: TemplateDefinition = {
  metadata: {
    id: "shoply-minimal",
    name: "Shoply Minimal",
    slug: "minimal",
    description: "Diseño limpio y moderno enfocado en la claridad de tus productos. Ideal para cualquier tipo de negocio que busque simplicidad.",
    category: "general",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#111111",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#111111",
      card: "#ffffff",
      muted: "#f8fafc",
      mutedForeground: "#64748b",
      accent: "#111111",
      border: "#e2e8f0",
      radius: "0rem"
    },
    typography: { heading: "Inter", body: "Inter" },
    header: { announcement: "¡Bienvenidos a nuestra tienda!", showWhatsapp: true },
    footer: { text: "Impulsado por Shoply" }
  },
  presets: [
    {
      id: "minimal-dark",
      name: "Minimal Dark",
      colors: { primary: "#ffffff", primaryForeground: "#000000", background: "#000000", foreground: "#ffffff", card: "#111111", border: "#222222" },
      typography: { heading: "Inter", body: "Inter" }
    }
  ],
  initialBlocks: [
    { id: "hero-1", type: "hero", position: 0, settings: { title: "Elegancia Simple", subtitle: "Descubre nuestra selección curada de productos esenciales.", ctaLabel: "Ver Colección", ctaHref: "/products" } },
    { id: "products-1", type: "featured_products", position: 1, settings: { title: "Nuestros Favoritos", limit: 4 } }
  ]
};
