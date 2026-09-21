import { TemplateDefinition } from "../types";

export const beauty: TemplateDefinition = {
  metadata: {
    id: "shoply-beauty",
    name: "Shoply Beauty",
    slug: "beauty",
    description: "Diseño sofisticado y delicado. Perfecto para cosmética, maquillaje y cuidado personal.",
    category: "beauty",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#f472b6",
      primaryForeground: "#ffffff",
      background: "#fffafb",
      foreground: "#1f2937",
      card: "#ffffff",
      muted: "#fdf2f8",
      mutedForeground: "#9d174d",
      accent: "#ec4899",
      border: "#fbcfe8",
      radius: "1rem"
    },
    typography: { heading: "Poppins", body: "Inter" },
    header: { announcement: "Tu rutina de skincare empieza aquí", showWhatsapp: true },
    footer: { text: "Shoply Beauty - Brilla con nosotros" }
  },
  presets: [],
  initialBlocks: [
    { id: "hero-beauty", type: "hero", position: 0, settings: { title: "Resalta tu Belleza Natural", subtitle: "Productos dermatológicamente probados para tu piel.", ctaLabel: "Ver Rutinas", ctaHref: "/products", imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfad403348?auto=format&fit=crop&q=80&w=1200" } },
    { id: "new-beauty", type: "new_products", position: 1, settings: { title: "Nuevos Lanzamientos", limit: 4 } }
  ]
};
