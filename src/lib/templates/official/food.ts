import { TemplateDefinition } from "../types";

export const food: TemplateDefinition = {
  metadata: {
    id: "shoply-food",
    name: "Shoply Food",
    slug: "food",
    description: "Diseño vibrante enfocado en el apetito. Ideal para restaurantes, cafeterías y pastelerías.",
    category: "food",
    version: "1.0.0",
    official: true,
    previewImageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400",
    supportedFeatures: ["page-builder", "theme-editor", "catalog", "delivery"]
  },
  defaultTheme: {
    brand: {},
    colors: {
      primary: "#ea580c",
      primaryForeground: "#ffffff",
      background: "#ffffff",
      foreground: "#111827",
      card: "#ffffff",
      muted: "#fff7ed",
      mutedForeground: "#9a3412",
      accent: "#fb923c",
      border: "#fed7aa",
      radius: "0.5rem"
    },
    typography: { heading: "Inter", body: "Inter" },
    header: { announcement: "Pide ahora y recíbelo en menos de 45 min", showWhatsapp: true },
    footer: { text: "Hecho con amor por Shoply Food" }
  },
  presets: [],
  initialBlocks: [
    { id: "hero-food", type: "hero", position: 0, settings: { title: "Sabor que Enamora", subtitle: "Los mejores ingredientes llevados a tu mesa.", ctaLabel: "Pedir Ahora", ctaHref: "/products", imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=1200" } },
    { id: "cats-food", type: "categories", position: 1, settings: { title: "Nuestra Carta" } }
  ]
};
