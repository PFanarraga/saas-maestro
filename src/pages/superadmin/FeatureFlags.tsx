import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Flag, Plus, Loader2, Info, Trash2, Rocket, Beaker } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function FeatureFlags() {
  const { request, isLoading } = useApi();
  const [flags, setFlags] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [newFlag, setNewFlag] = useState({ key: "", description: "" });

  const refresh = async () => {
    const { data } = await request<any[]>("/platform/feature-flags");
    if (data) setFlags(data);
  };

  useEffect(() => { refresh(); }, [request]);

  const toggleFlag = async (key: string, enabled: boolean) => {
    const { error } = await request("/platform/feature-flags", {
      method: "POST",
      body: JSON.stringify({ key, enabled })
    });
    if (error) toast.error(error);
    else { toast.success(`Flag '${key}' ${enabled ? 'activada' : 'desactivada'}`); refresh(); }
  };

  const handleCreate = async () => {
    if (!newFlag.key.trim()) return;
    const { error } = await request("/platform/feature-flags", {
      method: "POST",
      body: JSON.stringify({ ...newFlag, enabled: false })
    });
    if (error) toast.error(error);
    else { toast.success("Flag creada"); setOpen(false); refresh(); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Feature Flags</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Controla el despliegue de funcionalidades en tiempo real.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
           <DialogTrigger asChild>
             <Button className="font-bold text-xs shadow-lg shadow-primary/20">
               <Plus className="size-3.5 mr-2" /> NUEVA FLAG
             </Button>
           </DialogTrigger>
           <DialogContent className="border-none shadow-2xl">
              <DialogHeader>
                 <DialogTitle>Nueva Característica</DialogTitle>
                 <CardDescription>Define una nueva flag para controlar funciones en la App.</CardDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                 <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-400">Identificador (KEY)</Label>
                    <Input placeholder="ej: beta_storefront" value={newFlag.key} onChange={e => setNewFlag({...newFlag, key: e.target.value.toLowerCase().replace(/\s+/g, '_')})} />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-slate-400">Descripción</Label>
                    <Input placeholder="Describe brevemente qué controla esta flag..." value={newFlag.description} onChange={e => setNewFlag({...newFlag, description: e.target.value})} />
                 </div>
              </div>
              <DialogFooter className="pt-6">
                 <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                 <Button onClick={handleCreate}>Crear Deshabilitada</Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-4 mb-8">
         <Beaker className="size-5 text-amber-600 shrink-0 mt-0.5" />
         <div className="text-xs text-amber-800 leading-relaxed">
           <p className="font-bold mb-1">Entorno de Experimentación</p>
           <p>Las flags aquí listadas afectan directamente el comportamiento del Frontend y Backend en Producción. Úsalas con precaución para habilitar betas o apagar funciones críticas.</p>
         </div>
      </div>

      <div className="grid gap-4">
        {flags.map((f) => (
          <Card key={f.key} className={cn(
            "border-none shadow-sm transition-all overflow-hidden",
            f.enabled ? "bg-white ring-1 ring-emerald-100" : "bg-white/60 grayscale-[0.5]"
          )}>
            <CardContent className="p-6">
               <div className="flex items-start justify-between gap-6">
                  <div className="flex gap-4">
                     <div className={cn(
                       "size-10 rounded-xl flex items-center justify-center shrink-0",
                       f.enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                     )}>
                        {f.enabled ? <Rocket className="size-5" /> : <Flag className="size-5" />}
                     </div>
                     <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-black text-slate-900 font-mono tracking-tight">{f.key}</span>
                           <Badge variant="outline" className="text-[8px] h-4 font-bold border-slate-200 uppercase tracking-tighter">PROD</Badge>
                        </div>
                        <p className="text-xs text-slate-500 leading-normal max-w-lg">{f.description || "Sin descripción proporcionada."}</p>
                     </div>
                  </div>

                  <div className="flex items-center gap-6">
                     <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-0.5">Estado</p>
                        <p className={cn("text-[10px] font-black uppercase", f.enabled ? "text-emerald-600" : "text-slate-400")}>
                           {f.enabled ? "ACTIVA" : "INACTIVA"}
                        </p>
                     </div>
                     <Switch
                       checked={f.enabled}
                       onCheckedChange={(val) => toggleFlag(f.key, val)}
                     />
                  </div>
               </div>
            </CardContent>
          </Card>
        ))}

        {flags.length === 0 && !isLoading && (
          <div className="py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl">
             <Flag className="size-12 text-slate-200 mx-auto mb-4" />
             <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay Feature Flags definidas</p>
          </div>
        )}
      </div>
    </div>
  );
}
