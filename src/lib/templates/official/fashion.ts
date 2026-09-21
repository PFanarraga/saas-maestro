import { TemplateDefinition } from "../types";

export const fashion: TemplateDefinition = {
  metadata: {
    id: "shoply-fashion",
    name: "Shoply Fashion",
    slug: "fashion",
    description: "Estética editorial de alta costura. Ideal para marcas de ropa, accesorios y calzado que quieren destacar su fotografía.",
    category: "fashion",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#000000",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#111111",
      card: "#fafafa",
      muted: "#f1f5f9",
      mutedForeground: "#475569",
      accent: "#000000",
      border: "#111111",
      radius: "0rem"
    },
    typography: { heading: "Georgia", body: "Inter" },
    header: { announcement: "Envío gratis en compras mayores a S/ 200", showWhatsapp: true },
    footer: { text: "Shoply Fashion Edition" }
  },
  presets: [
    {
      id: "editorial-vogue",
      name: "Editorial Vogue",
      colors: { primary: "#d946ef", primaryForeground: "#ffffff", background: "#fff7ed", foreground: "#1c1917" },
      typography: { heading: "Times New Roman", body: "Inter" }
    }
  ],
  initialBlocks: [
    { id: "hero-fashion", type: "hero", position: 0, settings: { title: "Nueva Temporada", subtitle: "Lo último en tendencias globales ha llegado.", ctaLabel: "Explorar Lookbook", ctaHref: "/products", imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1200" } },
    { id: "cats-fashion", type: "categories", position: 1, settings: { title: "Compra por Categoría" } },
    { id: "feat-fashion", type: "featured_products", position: 2, settings: { title: "Tendencias Actuales", limit: 8 } }
  ]
};
