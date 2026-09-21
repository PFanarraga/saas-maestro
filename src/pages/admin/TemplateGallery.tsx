import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, Eye, Layout, Palette, Loader2,
  Monitor, Tablet, Smartphone, ArrowRight, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { TemplateRegistry } from "@/lib/templates/registry";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function TemplateGallery() {
  const { request, isLoading: apiLoading } = useApi();
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const templates = TemplateRegistry.getAll();
  const filteredTemplates = filter === "all" ? templates : templates.filter(t => t.metadata.category === filter);

  useEffect(() => {
    request<any>("/store/settings").then(({ data }) => {
      if (data?.tenant?.activeTemplateId) {
        setCurrentTemplateId(data.tenant.activeTemplateId);
      }
    });
  }, [request]);

  const handleApply = async (templateId: string) => {
    const t = TemplateRegistry.getById(templateId);
    if (!confirm(`¿Quieres aplicar el diseño "${t.metadata.name}"? Los colores y tipografía se actualizarán, pero tus productos y datos seguirán intactos.`)) return;

    setBusy(true);
    try {
      const { error } = await request("/store/theme/apply-template", {
        method: "POST",
        body: JSON.stringify({ template: templateId })
      });
      if (error) throw new Error(error);
      toast.success("Diseño aplicado con éxito");
      setCurrentTemplateId(templateId);
      // Reload to apply new styles
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      toast.error(e.message || "Error al aplicar template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Galería de Diseños</h1>
          <p className="text-slate-500 mt-1 font-medium">Personaliza la identidad visual de tu tienda con templates profesionales.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
        <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
          <TabsList className="bg-transparent h-10 gap-1">
            <TabsTrigger value="all" className="rounded-xl px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white">Todos</TabsTrigger>
            <TabsTrigger value="fashion" className="rounded-xl px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white">Moda</TabsTrigger>
            <TabsTrigger value="food" className="rounded-xl px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white">Comida</TabsTrigger>
            <TabsTrigger value="beauty" className="rounded-xl px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white">Belleza</TabsTrigger>
            <TabsTrigger value="technology" className="rounded-xl px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white">Tecnología</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 px-2">
           <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold uppercase tracking-tighter text-[10px]">8 OFICIALES</Badge>
           <Badge variant="outline" className="text-slate-400 font-bold uppercase tracking-tighter text-[10px]">v1.0.0</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredTemplates.map((template, i) => {
            const isActive = currentTemplateId === template.metadata.id;
            return (
              <motion.div
                key={template.metadata.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <Card className={cn(
                  "group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 relative",
                  isActive ? "ring-2 ring-primary ring-offset-2" : "ring-1 ring-slate-200"
                )}>
                  {isActive && (
                    <div className="absolute top-4 right-4 z-10 bg-primary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in">
                      <CheckCircle2 className="size-3" /> ACTIVOHORA
                    </div>
                  )}

                  <div className="aspect-[4/3] overflow-hidden bg-slate-100 relative">
                    <img
                      src={template.metadata.previewImageUrl}
                      alt={template.metadata.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                       <Button variant="secondary" size="sm" className="font-bold text-xs h-9">
                         <Eye className="size-3.5 mr-2" /> VISTA PREVIA
                       </Button>
                    </div>
                  </div>

                  <CardHeader className="bg-white">
                    <div className="flex justify-between items-start mb-1">
                       <CardTitle className="text-lg font-bold text-slate-900">{template.metadata.name}</CardTitle>
                       <Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter opacity-60">{template.metadata.category}</Badge>
                    </div>
                    <CardDescription className="text-xs font-medium leading-relaxed line-clamp-2 min-h-[32px]">
                      {template.metadata.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="bg-white pt-0 pb-6">
                     <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                        <div className="flex -space-x-2">
                           {Object.values(template.defaultTheme.colors).slice(0, 4).map((color, idx) => (
                             <div key={idx} className="size-5 rounded-full border-2 border-white shadow-sm" style={{ background: color as string }} />
                           ))}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paleta base</span>
                     </div>
                  </CardContent>

                  <CardFooter className="bg-slate-50/50 p-4 border-t border-slate-100">
                    <Button
                      className="w-full font-bold text-xs h-10 tracking-tight"
                      variant={isActive ? "secondary" : "default"}
                      disabled={isActive || busy}
                      onClick={() => handleApply(template.metadata.id)}
                    >
                      {busy ? <Loader2 className="animate-spin size-4" /> : isActive ? "DISEÑO ACTUAL" : "USAR ESTE DISEÑO"}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="bg-indigo-900 text-white rounded-3xl p-8 relative overflow-hidden shadow-2xl shadow-indigo-200">
         <div className="absolute right-[-10%] top-[-20%] size-64 bg-white/10 rounded-full blur-3xl" />
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-2 text-center md:text-left">
               <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-primary-foreground text-[10px] font-black uppercase tracking-widest mb-2 border border-white/10">
                  <Sparkles className="size-3 mr-2" /> PRÓXIMAMENTE
               </div>
               <h2 className="text-2xl font-bold tracking-tight">Marketplace de Diseños</h2>
               <p className="text-indigo-100/70 text-sm max-w-md font-medium">Estamos trabajando en un sistema para que puedas subir tus propios templates o comprar diseños de la comunidad.</p>
            </div>
            <Button variant="secondary" className="font-black text-xs px-8 h-12 shadow-xl">
               QUIERO SER DISEÑADOR <ArrowRight className="ml-2 size-4" />
            </Button>
         </div>
      </div>
    </div>
  );
}
