import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, Globe, Paintbrush, Save } from "lucide-react";
import type { ThemeConfig } from "@/lib/utils-shared";

const COLOR_FIELDS: Array<{ key: keyof ThemeConfig["colors"]; label: string }> = [
  { key: "primary", label: "Primario" },
  { key: "primaryForeground", label: "Texto sobre primario" },
  { key: "background", label: "Fondo" },
  { key: "foreground", label: "Texto" },
  { key: "card", label: "Tarjetas" },
  { key: "muted", label: "Suave" },
  { key: "mutedForeground", label: "Texto suave" },
  { key: "accent", label: "Acento" },
  { key: "border", label: "Bordes" },
];

const DEFAULT_THEME: ThemeConfig = {
  brand: {},
  colors: { primary: "#111111", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#111111", card: "#fafafa", muted: "#f5f5f5", mutedForeground: "#6b7280", accent: "#111111", border: "#e5e7eb", radius: "0.5rem" },
  typography: { heading: "Inter", body: "Inter" },
  header: {},
  footer: {},
};

export default function ThemeEditor() {
  const draft = useQuery(api.store.getThemeDraft);
  const versions = useQuery(api.store.themeVersions);
  const access = useQuery(api.platform.myAccess);
  const saveDraft = useMutation(api.store.saveThemeDraft);
  const publish = useMutation(api.store.publishTheme);
  const applyTemplate = useMutation(api.store.applyTemplate);

  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (draft && !loaded) {
      setTheme(draft.theme as ThemeConfig);
      setLoaded(true);
    }
  }, [draft, loaded]);

  const set = (patch: Partial<ThemeConfig>) => setTheme((t) => ({ ...t, ...patch }));
  const setColor = (key: string, value: string) => setTheme((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));

  const handleSave = async () => {
    try {
      await saveDraft({ theme });
      toast.success("Borrador guardado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handlePublish = async () => {
    try {
      await saveDraft({ theme });
      const v = await publish({});
      toast.success(`Tema publicado (v${v})`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleTemplate = async (tpl: string) => {
    try {
      await applyTemplate({ template: tpl });
      toast.success(`Plantilla "${tpl}" aplicada al borrador`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const c = theme.colors;
  const previewStyle = {
    "--preview-bg": c.background ?? "#ffffff",
    "--preview-fg": c.foreground ?? "#111111",
    "--preview-card": c.card ?? "#fafafa",
    "--preview-muted": c.muted ?? "#f5f5f5",
    "--preview-muted-fg": c.mutedForeground ?? "#6b7280",
    "--preview-primary": c.primary ?? "#111111",
    "--preview-primary-fg": c.primaryForeground ?? "#ffffff",
    "--preview-border": c.border ?? "#e5e7eb",
    "--preview-radius": c.radius ?? "0.5rem",
  } as React.CSSProperties;

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apariencia</h1>
          <p className="text-sm text-muted-foreground">Los cambios van a un borrador. Publica cuando estén listos.</p>
        </div>
        <div className="flex items-center gap-2">
          {access?.tenantSlug && (
            <Button variant="outline" onClick={() => window.open(`/t/${access.tenantSlug}?preview=draft`, "_blank")}>
              <Eye className="size-4 mr-1" /> Vista previa
            </Button>
          )}
          <Button variant="outline" onClick={handleSave}><Save className="size-4 mr-1" /> Guardar borrador</Button>
          <Button onClick={handlePublish}><Globe className="size-4 mr-1" /> Publicar</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline">Borrador v{draft?.version ?? 1}</Badge>
        {(versions ?? []).slice(0, 3).map((v: any) => (
          <Badge key={v._id} variant="secondary" className="text-[10px]">publicada v{v.version}</Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          <Tabs defaultValue="brand">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="brand">Marca</TabsTrigger>
              <TabsTrigger value="colors">Colores</TabsTrigger>
              <TabsTrigger value="typography">Tipografía</TabsTrigger>
              <TabsTrigger value="layout">Header/Footer</TabsTrigger>
            </TabsList>
            <TabsContent value="brand" className="space-y-3 pt-4">
              <div className="space-y-1">
                <Label>Nombre visible</Label>
                <Input value={theme.brand.name ?? ""} onChange={(e) => set({ brand: { ...theme.brand, name: e.target.value } })} />
              </div>
              <div className="space-y-1">
                <Label>URL del logo</Label>
                <Input value={theme.brand.logoUrl ?? ""} onChange={(e) => set({ brand: { ...theme.brand, logoUrl: e.target.value } })} placeholder="https://…" />
              </div>
              <div className="space-y-1">
                <Label>URL del favicon</Label>
                <Input value={theme.brand.faviconUrl ?? ""} onChange={(e) => set({ brand: { ...theme.brand, faviconUrl: e.target.value } })} placeholder="https://…" />
              </div>
              <div className="space-y-2 pt-2">
                <Label>Plantilla rápida</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleTemplate("minimal")}><Paintbrush className="size-3.5 mr-1" /> Minimal</Button>
                  <Button variant="outline" size="sm" onClick={() => handleTemplate("vibrant")}><Paintbrush className="size-3.5 mr-1" /> Vibrante</Button>
                  <Button variant="outline" size="sm" onClick={() => handleTemplate("classic")}><Paintbrush className="size-3.5 mr-1" /> Clásica</Button>
                </div>
                <p className="text-xs text-muted-foreground">Sobrescribe los colores del borrador con la plantilla.</p>
              </div>
            </TabsContent>
            <TabsContent value="colors" className="pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {COLOR_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={(c[f.key] as string) ?? "#000000"}
                        onChange={(e) => setColor(f.key as string, e.target.value)}
                        className="size-9 rounded border cursor-pointer bg-background"
                        aria-label={f.label}
                      />
                      <Input value={(c[f.key] as string) ?? ""} onChange={(e) => setColor(f.key as string, e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs">Radio de bordes</Label>
                  <Select value={c.radius ?? "0.5rem"} onValueChange={(v) => setColor("radius", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0rem">Recto</SelectItem>
                      <SelectItem value="0.375rem">Pequeño</SelectItem>
                      <SelectItem value="0.5rem">Medio</SelectItem>
                      <SelectItem value="1rem">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="typography" className="space-y-3 pt-4">
              <div className="space-y-1">
                <Label>Fuente de títulos</Label>
                <Select value={theme.typography.heading ?? "Inter"} onValueChange={(v) => set({ typography: { ...theme.typography, heading: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Inter", "Georgia", "Poppins", "Verdana", "Arial", "Times New Roman"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fuente de cuerpo</Label>
                <Select value={theme.typography.body ?? "Inter"} onValueChange={(v) => set({ typography: { ...theme.typography, body: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Inter", "Georgia", "Poppins", "Verdana", "Arial", "Times New Roman"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="layout" className="space-y-3 pt-4">
              <div className="space-y-1">
                <Label>Anuncio superior (barra)</Label>
                <Input value={theme.header.announcement ?? ""} onChange={(e) => set({ header: { ...theme.header, announcement: e.target.value } })} placeholder="Envío gratis desde S/ 100" />
              </div>
              <div className="space-y-1">
                <Label>Texto del footer</Label>
                <Input value={theme.footer.text ?? ""} onChange={(e) => set({ footer: { ...theme.footer, text: e.target.value } })} placeholder="© 2026 Mi Tienda" />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live preview */}
        <Card className="lg:sticky lg:top-24 self-start">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vista previa</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div style={previewStyle} className="preview-scope">
              <div className="pv-bg text-[13px] leading-relaxed">
                <div className="pv-announcement px-4 py-1.5 text-center text-[11px]">Envío gratis desde S/ 100</div>
                <div className="pv-header flex items-center justify-between px-4 py-3">
                  <span className="font-bold" style={{ fontFamily: theme.typography.heading }}>{theme.brand.name || "Mi Tienda"}</span>
                  <span className="pv-cta px-3 py-1.5 text-[11px] font-medium">Contactar</span>
                </div>
                <div className="pv-hero p-5 text-center">
                  <p className="pv-hero-title text-xl font-bold mb-1" style={{ fontFamily: theme.typography.heading }}>Nueva colección</p>
                  <p className="pv-hero-sub text-xs mb-3">Descubre lo último de la temporada</p>
                  <span className="pv-cta inline-block px-4 py-2 text-xs font-medium">Comprar ahora</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
                  {["Producto A", "Producto B"].map((n) => (
                    <div key={n} className="pv-card rounded-[var(--preview-radius)] p-2.5">
                      <div className="pv-img mb-2 rounded-[calc(var(--preview-radius)-2px)]" />
                      <p className="font-medium text-[11px]">{n}</p>
                      <p className="pv-price text-[11px] font-semibold">S/ 59.90</p>
                    </div>
                  ))}
                </div>
                <div className="pv-footer px-4 py-3 text-center text-[10px]">{theme.footer.text || "© 2026 Mi Tienda"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        .preview-scope { background: var(--preview-bg); color: var(--preview-fg); border-radius: var(--preview-radius); overflow: hidden; border: 1px solid var(--preview-border); font-family: var(--pv-body, Inter); }
        .preview-scope .pv-announcement { background: var(--preview-primary); color: var(--preview-primary-fg); }
        .preview-scope .pv-header { background: var(--preview-bg); border-bottom: 1px solid var(--preview-border); }
        .preview-scope .pv-cta { background: var(--preview-primary); color: var(--preview-primary-fg); border-radius: var(--preview-radius); }
        .preview-scope .pv-hero { background: var(--preview-muted); }
        .preview-scope .pv-hero-title { color: var(--preview-fg); }
        .preview-scope .pv-hero-sub { color: var(--preview-muted-fg); }
        .preview-scope .pv-card { background: var(--preview-card); border: 1px solid var(--preview-border); }
        .preview-scope .pv-img { background: var(--preview-muted); height: 72px; }
        .preview-scope .pv-price { color: var(--preview-primary); }
        .preview-scope .pv-footer { background: var(--preview-muted); color: var(--preview-muted-fg); }
      `}</style>
    </div>
  );
}
