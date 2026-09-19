import { useEffect, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function StoreSettings() {
  const { request, isLoading } = useApi();
  const [data, setData] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    whatsappPhone: "",
    whatsappEnabled: true,
    couponsEnabled: true,
    deliveryEnabled: true,
    paymentProvider: "manual" as "manual" | "culqi",
    currency: "PEN",
    seoTitle: "",
    seoDescription: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    request<any>("/store/settings").then(({ data }) => setData(data));
  }, [request]);

  useEffect(() => {
    if (data?.tenant && !loaded) {
      const t = data.tenant;
      setForm({
        name: t.name ?? "",
        whatsappPhone: t.whatsappPhone ?? "",
        whatsappEnabled: t.whatsappEnabled ?? true,
        couponsEnabled: t.couponsEnabled ?? true,
        deliveryEnabled: t.deliveryEnabled ?? true,
        paymentProvider: (t.paymentProvider ?? "manual") as "manual" | "culqi",
        currency: t.currency ?? "PEN",
        seoTitle: t.seo?.title ?? "",
        seoDescription: t.seo?.description ?? "",
      });
      setLoaded(true);
    }
  }, [data, loaded]);

  const handleSave = async () => {
    try {
      const { error } = await request("/store/settings", {
        method: "POST",
        body: JSON.stringify(form)
      });
      if (error) throw new Error(error);
      toast.success("Configuración guardada");
    } catch (e: any) { toast.error(e.message || "Error"); }
  };

  if (isLoading || !data) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-6 lg:p-8 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Información de la tienda</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["PEN", "USD", "EUR", "MXN", "CLP", "ARS", "COP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Proveedor de pago</Label>
              <Select value={form.paymentProvider} onValueChange={(v) => setForm({ ...form, paymentProvider: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual / link interno</SelectItem>
                  <SelectItem value="culqi">Culqi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">WhatsApp</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Número (con código de país)</Label>
            <Input value={form.whatsappPhone} onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })} placeholder="51987654321" />
            <p className="text-xs text-muted-foreground">Sin "+", empieza con el código de país.</p>
          </div>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Botones de WhatsApp</p><p className="text-xs text-muted-foreground">Consultar producto, comprar por chat, etc.</p></div>
            <Switch checked={form.whatsappEnabled} onCheckedChange={(v) => setForm({ ...form, whatsappEnabled: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Ventas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Cupones</p><p className="text-xs text-muted-foreground">Permitir códigos de descuento en el checkout</p></div>
            <Switch checked={form.couponsEnabled} onCheckedChange={(v) => setForm({ ...form, couponsEnabled: v })} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Delivery</p><p className="text-xs text-muted-foreground">Mostrar métodos de entrega en el checkout</p></div>
            <Switch checked={form.deliveryEnabled} onCheckedChange={(v) => setForm({ ...form, deliveryEnabled: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">SEO <Badge variant="outline" className="text-[10px]">{(data.tenant as any)?.slug}.shoply.app</Badge></CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} placeholder="Mi Tienda — Productos con delivery" maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label>Meta description</Label>
            <Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} placeholder="Descripción de la tienda para buscadores" maxLength={300} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave}><Save className="size-4 mr-1" /> Guardar cambios</Button>
    </div>
  );
}
