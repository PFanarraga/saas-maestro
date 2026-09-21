import { TemplateDefinition } from "./types";
import { minimal } from "./official/minimal";
import { fashion } from "./official/fashion";
import { beauty } from "./official/beauty";
import { food } from "./official/food";
import { market } from "./official/market";
import { tech } from "./official/tech";
import { boutique } from "./official/boutique";
import { classic } from "./official/classic";

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
