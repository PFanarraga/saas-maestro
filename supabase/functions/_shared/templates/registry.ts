import { TemplateDefinition } from "./types.ts";
import { minimal } from "./official/minimal.ts";
import { fashion } from "./official/fashion.ts";
import { beauty } from "./official/beauty.ts";
import { food } from "./official/food.ts";
import { market } from "./official/market.ts";
import { tech } from "./official/tech.ts";
import { boutique } from "./official/boutique.ts";
import { classic } from "./official/classic.ts";

const OFFICIAL_TEMPLATES: TemplateDefinition[] = [
  minimal,
  fashion,
  beauty,
  food,
  market,
  tech,
  boutique,
  classic
];

export const TemplateRegistry = {
  getAll: () => OFFICIAL_TEMPLATES,
  getById: (id: string) => OFFICIAL_TEMPLATES.find(t => t.metadata.id === id) || minimal,
  getBySlug: (slug: string) => OFFICIAL_TEMPLATES.find(t => t.metadata.slug === slug) || minimal,
  getByCategory: (cat: string) => OFFICIAL_TEMPLATES.filter(t => t.metadata.category === cat),
  getDefault: () => minimal
};
