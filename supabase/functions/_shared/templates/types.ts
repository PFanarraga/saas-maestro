export type ThemeConfig = {
  brand: { name?: string; logoUrl?: string; faviconUrl?: string };
  colors: {
    primary?: string;
    primaryForeground?: string;
    background?: string;
    foreground?: string;
    card?: string;
    muted?: string;
    mutedForeground?: string;
    accent?: string;
    border?: string;
    radius?: string;
  };
  typography: { heading?: string; body?: string };
  header: { announcement?: string; links?: Array<{ label: string; href: string }>; showWhatsapp?: boolean };
  footer: { text?: string; links?: Array<{ label: string; href: string }> };
};

export type PageBlock = {
  id: string;
  type: string;
  position: number;
  hidden?: boolean;
  settings: Record<string, any>;
};

export type TemplateCategory = "general" | "fashion" | "beauty" | "food" | "market" | "technology" | "boutique";

export type TemplatePreset = {
  id: string;
  name: string;
  colors: ThemeConfig["colors"];
  typography: ThemeConfig["typography"];
};

export type TemplateMetadata = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: TemplateCategory;
  version: string;
  official: boolean;
  previewImageUrl: string;
  supportedFeatures: string[];
};

export type TemplateDefinition = {
  metadata: TemplateMetadata;
  defaultTheme: ThemeConfig;
  presets: TemplatePreset[];
  initialBlocks: PageBlock[];
};
