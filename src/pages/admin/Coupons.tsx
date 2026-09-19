import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils-shared";

type Coupon = {
  id: string;
  code: string;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: number;
  minAmount?: number;
  maxUses?: number;
  endsAt?: number;
  isActive: boolean;
  usageCount: number;
};

export default function AdminCoupons() {
  const { request } = useApi();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);

  const refreshData = async () => {
    const { data } = await request<Coupon[]>("/store/coupons");
    setCoupons(data);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: undefined as string | undefined,
    code: "",
    type: "percentage" as Coupon["type"],
    value: "10",
    minAmount: "",
    maxUses: "",
    isActive: true,
  });

  const handleSave = async (payload?: any) => {
    try {
      const body = payload || {
        id: form.id,
        code: form.code.toUpperCase(),
        type: form.type,
        value: parseFloat(form.value) || 0,
        minAmount: form.minAmount ? parseFloat(form.minAmount) : undefined,
        maxUses: form.maxUses ? parseInt(form.maxUses, 10) : undefined,
        isActive: form.isActive,
      };
      if (!body.code.trim()) { toast.error("El código es obligatorio"); return; }
      const { error } = await request("/store/coupons", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (error) throw new Error(error);
      toast.success(body.id ? "Cupón actualizado" : "Cupón creado");
      setOpen(false);
      refreshData();
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`¿Eliminar cupón?`)) return;
    const { error } = await request(`/store/coupons/${id}`, { method: "DELETE" });
    if (error) toast.error(error);
    else { toast.success("Eliminado"); refreshData(); }
  };

  const typeLabel = (c: Coupon) =>
    c.type === "percentage" ? `${c.value}% dcto.` : c.type === "fixed_amount" ? `${formatMoney(c.value)} dcto.` : "Envío gratis";

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Cupones</h1>
        <Button onClick={() => { setForm({ id: undefined, code: "", type: "percentage", value: "10", minAmount: "", maxUses: "", isActive: true }); setOpen(true); }}>
          <Plus className="size-4 mr-1" /> Nuevo cupón
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Beneficio</TableHead>
                <TableHead className="hidden md:table-cell">Restricciones</TableHead>
                <TableHead className="hidden sm:table-cell">Usos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(coupons ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="outline" className="font-mono">{c.code}</Badge></TableCell>
                  <TableCell className="text-sm">{typeLabel(c)}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {c.minAmount ? `Mín. ${formatMoney(c.minAmount)}` : "—"}
                    {c.maxUses ? ` · máx ${c.maxUses} usos` : ""}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{c.usageCount}{c.maxUses ? `/${c.maxUses}` : ""}</TableCell>
                  <TableCell>
                    <Switch checked={c.isActive} onCheckedChange={(v) => handleSave({ ...c, id: c.id, isActive: v })} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(coupons ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">Sin cupones todavía.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{form.id ? "Editar cupón" : "Nuevo cupón"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Código *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BIENVENIDO10" className="font-mono" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Coupon["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje</SelectItem>
                    <SelectItem value="fixed_amount">Monto fijo</SelectItem>
                    <SelectItem value="free_shipping">Envío gratis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{form.type === "percentage" ? "Porcentaje (%)" : form.type === "fixed_amount" ? "Monto (S/)" : "Valor"}</Label>
                <Input type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} disabled={form.type === "free_shipping"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Monto mínimo (S/)</Label><Input type="number" min="0" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} placeholder="opcional" /></div>
              <div className="space-y-1"><Label>Usos máximos</Label><Input type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="opcional" /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Activo</Label><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
