import { useEffect, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Eye, Globe, Plus, Save, Trash2 } from "lucide-react";
import type { PageBlock } from "@/lib/utils-shared";

const BLOCK_LIBRARY: Array<{ type: string; label: string; defaults: Record<string, any> }> = [
  { type: "hero", label: "Hero", defaults: { title: "Gran titular", subtitle: "Un subtítulo atractivo", ctaLabel: "Ver productos", ctaHref: "#products", imageUrl: "", align: "center" } },
  { type: "banner", label: "Banner", defaults: { imageUrl: "", title: "Promoción", subtitle: "Solo por esta semana", ctaLabel: "Ver más", ctaHref: "#products" } },
  { type: "categories", label: "Categorías", defaults: { title: "Categorías" } },
  { type: "featured_products", label: "Destacados", defaults: { title: "Productos destacados", limit: 8 } },
  { type: "new_products", label: "Novedades", defaults: { title: "Novedades", limit: 8 } },
  { type: "text", label: "Texto", defaults: { title: "Título", body: "Escribe aquí tu contenido." } },
  { type: "image", label: "Imagen", defaults: { imageUrl: "", caption: "" } },
  { type: "video", label: "Video", defaults: { videoUrl: "", title: "" } },
  { type: "testimonials", label: "Testimonios", defaults: { title: "Lo que dicen nuestros clientes", items: [{ name: "Cliente", text: "¡Excelente servicio!" }] } },
  { type: "faq", label: "FAQ", defaults: { title: "Preguntas frecuentes", items: [{ q: "¿Hacen envíos?", a: "Sí, a todo el país." }] } },
  { type: "newsletter", label: "Newsletter", defaults: { title: "Suscríbete", subtitle: "Recibe ofertas exclusivas" } },
  { type: "spacer", label: "Espaciador", defaults: { height: 40 } },
];

export default function PageBuilder() {
  const { request } = useApi();
  const [draft, setDraft] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);

  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [title, setTitle] = useState("Inicio");
  const [dirty, setDirty] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const refreshData = async () => {
    request<any>("/store/pages/home/draft").then(({ data }) => setDraft(data));
    request<any>("/me/access").then(({ data }) => setAccess(data));
  };

  useEffect(() => {
    refreshData();
  }, [request]);

  useEffect(() => {
    if (draft && draft.id !== loadedId) {
      setBlocks(draft.blocks as PageBlock[]);
      setTitle(draft.title);
      setLoadedId(draft.id);
      setDirty(false);
    }
  }, [draft, loadedId]);

  const touch = (next: PageBlock[]) => { setBlocks(next); setDirty(true); };

  const addBlock = (type: string) => {
    const lib = BLOCK_LIBRARY.find((b) => b.type === type);
    if (!lib) return;
    touch([...blocks, { id: `${type}-${Date.now()}`, type, position: blocks.length, settings: { ...lib.defaults } }]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    touch(next.map((b, i) => ({ ...b, position: i })));
  };

  const remove = (id: string) => touch(blocks.filter((b) => b.id !== id));
  const duplicate = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    touch([...blocks, { ...b, id: `${b.type}-${Date.now()}`, position: blocks.length }]);
  };
  const toggleHidden = (id: string) => touch(blocks.map((b) => (b.id === id ? { ...b, hidden: !b.hidden } : b)));
  const updateSettings = (id: string, key: string, value: any) =>
    touch(blocks.map((b) => (b.id === id ? { ...b, settings: { ...b.settings, [key]: value } } : b)));

  const handleSave = async () => {
    try {
      const { error } = await request("/store/pages/home/draft", {
        method: "POST",
        body: JSON.stringify({ title, blocks: blocks.map((b, i) => ({ ...b, position: i })) })
      });
      if (error) throw new Error(error);
      setDirty(false);
      toast.success("Borrador guardado");
      refreshData();
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  const handlePublish = async () => {
    try {
      await request("/store/pages/home/draft", {
        method: "POST",
        body: JSON.stringify({ title, blocks: blocks.map((b, i) => ({ ...b, position: i })) })
      });
      const { data, error } = await request<any>("/store/pages/home/publish", { method: "POST" });
      if (error) throw new Error(error);
      setDirty(false);
      toast.success(`Página publicada (v${data})`);
      refreshData();
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  const settingsFields = (b: PageBlock): Array<{ key: string; label: string; type?: "text" | "textarea" | "number" }> => {
    switch (b.type) {
      case "hero":
        return [
          { key: "title", label: "Titular" },
          { key: "subtitle", label: "Subtítulo", type: "textarea" },
          { key: "ctaLabel", label: "Texto del botón" },
          { key: "ctaHref", label: "Enlace del botón" },
          { key: "imageUrl", label: "URL de imagen" },
        ];
      case "banner":
        return [
          { key: "imageUrl", label: "URL de imagen" },
          { key: "title", label: "Título" },
          { key: "subtitle", label: "Subtítulo" },
          { key: "ctaLabel", label: "Texto del botón" },
        ];
      case "text":
        return [{ key: "title", label: "Título" }, { key: "body", label: "Contenido", type: "textarea" }];
      case "image":
        return [{ key: "imageUrl", label: "URL de imagen" }, { key: "caption", label: "Leyenda" }];
      case "video":
        return [{ key: "videoUrl", label: "URL del video (embed)" }, { key: "title", label: "Título" }];
      case "featured_products":
      case "new_products":
        return [{ key: "title", label: "Título" }, { key: "limit", label: "Cantidad", type: "number" }];
      case "spacer":
        return [{ key: "height", label: "Altura (px)", type: "number" }];
      default:
        return [{ key: "title", label: "Título" }];
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Páginas</h1>
          <p className="text-sm text-muted-foreground">Constructor de bloques de la página de inicio (draft → publicar).</p>
        </div>
        <div className="flex items-center gap-2">
          {access?.tenantSlug && (
            <Button variant="outline" onClick={() => window.open(`/t/${access.tenantSlug}?preview=draft`, "_blank")}>
              <Eye className="size-4 mr-1" /> Vista previa
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={!dirty}><Save className="size-4 mr-1" /> Guardar</Button>
          <Button onClick={handlePublish}><Globe className="size-4 mr-1" /> Publicar</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{blocks.length} bloques</Badge>
            {dirty && <Badge className="text-[10px] bg-amber-100 text-amber-800">cambios sin guardar</Badge>}
          </div>
          {blocks.map((b, idx) => (
            <Card key={b.id} className={b.hidden ? "opacity-50" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">{BLOCK_LIBRARY.find((x) => x.type === b.type)?.label ?? b.type}</Badge>
                    {b.hidden && <span className="text-xs text-muted-foreground">(oculto)</span>}
                  </div>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowUp className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => move(idx, 1)} disabled={idx === blocks.length - 1}><ArrowDown className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => duplicate(b.id)}><Copy className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => toggleHidden(b.id)}>{b.hidden ? <Eye className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
                    <Button variant="ghost" size="icon" className="size-7 text-red-600" onClick={() => remove(b.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
                {settingsFields(b).map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    {f.type === "textarea" ? (
                      <Textarea rows={2} value={b.settings[f.key] ?? ""} onChange={(e) => updateSettings(b.id, f.key, e.target.value)} />
                    ) : (
                      <Input type={f.type === "number" ? "number" : "text"} value={b.settings[f.key] ?? ""} onChange={(e) => updateSettings(b.id, f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="self-start lg:sticky lg:top-24">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Agregar bloque</p>
            <div className="grid grid-cols-2 gap-2">
              {BLOCK_LIBRARY.map((b) => (
                <Button key={b.type} variant="outline" size="sm" className="justify-start" onClick={() => addBlock(b.type)}>
                  <Plus className="size-3.5 mr-1" /> {b.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
