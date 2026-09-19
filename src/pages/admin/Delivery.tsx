import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/utils-shared";
import { Id } from "@/convex/_generated/dataModel";

const METHOD_LABELS: Record<string, string> = { pickup: "Recojo", delivery: "Delivery", shipping: "Envío" };

export default function AdminDelivery() {
  const data = useQuery(api.store.listDelivery);
  const saveZone = useMutation(api.store.saveDeliveryZone);
  const deleteZone = useMutation(api.store.deleteDeliveryZone);
  const saveRate = useMutation(api.store.saveDeliveryRate);
  const deleteRate = useMutation(api.store.deleteDeliveryRate);

  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneForm, setZoneForm] = useState({ id: undefined as Id<"deliveryZones"> | undefined, name: "", isActive: true });
  const [rateOpen, setRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState({
    id: undefined as Id<"deliveryRates"> | undefined,
    zoneId: "" as string,
    name: "",
    method: "delivery" as "pickup" | "delivery" | "shipping",
    price: "5",
    freeOver: "",
    eta: "",
    isActive: true,
  });

  const handleSaveZone = async () => {
    try {
      if (!zoneForm.name.trim()) { toast.error("El nombre es obligatorio"); return; }
      await saveZone(zoneForm);
      toast.success("Zona guardada");
      setZoneOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleSaveRate = async () => {
    try {
      if (!rateForm.zoneId || !rateForm.name.trim()) { toast.error("Zona y nombre son obligatorios"); return; }
      await saveRate({
        id: rateForm.id,
        zoneId: rateForm.zoneId as Id<"deliveryZones">,
        name: rateForm.name,
        method: rateForm.method,
        price: parseFloat(rateForm.price) || 0,
        freeOver: rateForm.freeOver ? parseFloat(rateForm.freeOver) : undefined,
        eta: rateForm.eta || undefined,
        isActive: rateForm.isActive,
      });
      toast.success("Tarifa guardada");
      setRateOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Delivery</h1>
        <Button variant="outline" onClick={() => { setZoneForm({ id: undefined, name: "", isActive: true }); setZoneOpen(true); }}><Plus className="size-4 mr-1" /> Nueva zona</Button>
      </div>

      <div className="space-y-4">
        {(data?.zones ?? []).map((zone) => {
          const rates = (data?.rates ?? []).filter((r: any) => r.zoneId === zone._id);
          return (
            <Card key={zone._id}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{zone.name}</CardTitle>
                  {!zone.isActive && <Badge variant="outline" className="text-xs">Inactiva</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setRateForm({ id: undefined, zoneId: zone._id, name: "", method: "delivery", price: "5", freeOver: "", eta: "", isActive: true }); setRateOpen(true); }}>
                    <Plus className="size-3.5 mr-1" /> Tarifa
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => { if (confirm(`¿Eliminar zona "${zone.name}" y sus tarifas?`)) deleteZone({ id: zone._id }).then(() => toast.success("Zona eliminada")).catch((e) => toast.error(e.message)); }}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {rates.map((r: any) => (
                  <div key={r._id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.name} <Badge variant="outline" className="ml-1 text-[10px]">{METHOD_LABELS[r.method]}</Badge></p>
                      <p className="text-xs text-muted-foreground">
                        {r.price === 0 ? "Gratis" : formatMoney(r.price)}
                        {r.freeOver ? ` · gratis sobre ${formatMoney(r.freeOver)}` : ""}
                        {r.eta ? ` · ${r.eta}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.isActive} onCheckedChange={(v) => saveRate({ ...r, id: r._id, isActive: v }).catch((e: Error) => toast.error(e.message))} />
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setRateForm({ id: r._id, zoneId: r.zoneId, name: r.name, method: r.method, price: String(r.price), freeOver: r.freeOver ? String(r.freeOver) : "", eta: r.eta ?? "", isActive: r.isActive }); setRateOpen(true); }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => deleteRate({ id: r._id }).then(() => toast.success("Tarifa eliminada")).catch((e) => toast.error(e.message))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {rates.length === 0 && <p className="text-sm text-muted-foreground">Sin tarifas en esta zona.</p>}
              </CardContent>
            </Card>
          );
        })}
        {(data?.zones ?? []).length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Sin zonas de delivery. Crea la primera.</CardContent></Card>
        )}
      </div>

      {/* Zone dialog */}
      <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{zoneForm.id ? "Editar zona" : "Nueva zona"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nombre *</Label><Input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Zona A — Centro" /></div>
            <div className="flex items-center justify-between"><Label>Zona activa</Label><Switch checked={zoneForm.isActive} onCheckedChange={(v) => setZoneForm({ ...zoneForm, isActive: v })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setZoneOpen(false)}>Cancelar</Button><Button onClick={handleSaveZone}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{rateForm.id ? "Editar tarifa" : "Nueva tarifa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nombre *</Label><Input value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} placeholder="Delivery motorizado" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Método</Label>
                <Select value={rateForm.method} onValueChange={(v) => setRateForm({ ...rateForm, method: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="pickup">Recojo</SelectItem>
                    <SelectItem value="shipping">Envío</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Precio (S/)</Label><Input type="number" min="0" step="0.10" value={rateForm.price} onChange={(e) => setRateForm({ ...rateForm, price: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Gratis sobre (S/)</Label><Input type="number" min="0" value={rateForm.freeOver} onChange={(e) => setRateForm({ ...rateForm, freeOver: e.target.value })} placeholder="opcional" /></div>
              <div className="space-y-1"><Label>Tiempo estimado</Label><Input value={rateForm.eta} onChange={(e) => setRateForm({ ...rateForm, eta: e.target.value })} placeholder="24-48h" /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Activa</Label><Switch checked={rateForm.isActive} onCheckedChange={(v) => setRateForm({ ...rateForm, isActive: v })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRateOpen(false)}>Cancelar</Button><Button onClick={handleSaveRate}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
