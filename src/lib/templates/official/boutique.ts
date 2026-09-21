import { TemplateDefinition } from "../types";

export const boutique: TemplateDefinition = {
  metadata: {
    id: "shoply-boutique",
    name: "Shoply Boutique",
    slug: "boutique",
    description: "Cálido y personal. Enfocado en el storytelling para marcas artesanales y emprendimientos únicos.",
    category: "boutique",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1541692641319-981cc79ee10a?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#78350f",
      primaryForeground: "#ffffff",
      background: "#fffbeb",
      foreground: "#451a03",
      card: "#ffffff",
      muted: "#fef3c7",
      mutedForeground: "#92400e",
      accent: "#b45309",
      border: "#fcd34d",
      radius: "2rem"
    },
    typography: { heading: "Georgia", body: "Inter" },
    header: { announcement: "Hecho a mano con dedicación", showWhatsapp: true },
    footer: { text: "Shoply Boutique - Historias que inspiran" }
  },
  presets: [],
  initialBlocks: [
    { id: "hero-boutique", type: "hero", position: 0, settings: { title: "Objetos con Alma", subtitle: "Piezas únicas creadas por artesanos locales.", ctaLabel: "Nuestra Historia", ctaHref: "/products", imageUrl: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?auto=format&fit=crop&q=80&w=1200" } },
    { id: "feat-boutique", type: "featured_products", position: 1, settings: { title: "Selección del Mes", limit: 4 } }
  ]
};
