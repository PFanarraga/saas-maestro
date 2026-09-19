import { useMemo, useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, MessageCircle } from "lucide-react";
import { formatDateTime, formatMoney, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, whatsappLink } from "@/lib/utils-shared";

type Order = {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string;
  status: string;
  total: number;
  currency: string;
  deliveryMethod?: string;
  createdAt: number;
};

type OrderDetail = Order & {
  items: Array<{ id: string; name: string; variantLabel?: string; unitPrice: number; quantity: number; total: number }>;
  history: Array<{ id: string; toStatus: string; actor: string; note?: string; createdAt: number }>;
  paymentLinks: Array<{ id: string; url: string; status: string; provider: string }>;
  address?: { line1: string; city?: string; reference?: string };
  notes?: string;
  discountTotal: number;
  deliveryTotal: number;
  couponCode?: string;
};

const STATUS_FLOW = ["payment_pending", "paid", "processing", "ready", "shipped", "delivered", "cancelled"];

export default function AdminOrders() {
  const { request } = useApi();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  useEffect(() => {
    refreshOrders();
  }, []);

  useEffect(() => {
    if (selected) {
      request<OrderDetail>(`/orders/${selected}`).then(({ data }) => setDetail(data));
    } else {
      setDetail(null);
    }
  }, [selected, request]);

  const refreshOrders = async () => {
    request<Order[]>("/orders").then(({ data }) => setOrders(data));
  };

  const filtered = useMemo(() => {
    let items = orders ?? [];
    if (statusFilter !== "all") items = items.filter((o) => o.status === statusFilter);
    return items;
  }, [orders, statusFilter]);

  const handleStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await request(`/orders/${orderId}/status`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      if (error) throw new Error(error);
      toast.success(`Pedido actualizado a "${ORDER_STATUS_LABELS[status]}"`);
      refreshOrders();
      if (selected === orderId) {
        request<OrderDetail>(`/orders/${orderId}`).then(({ data }) => setDetail(data));
      }
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar");
    }
  };

  const handleCreateLink = async () => {
    if (!selected) return;
    try {
      const { data, error } = await request<any>(`/orders/${selected}/payment-link`, { method: "POST" });
      if (error || !data) { toast.error(error || "No se pudo crear el link"); return; }
      toast.success("Link de pago creado", {
        description: data.url,
        action: { label: "Copiar", onClick: () => { navigator.clipboard.writeText(`${window.location.origin}${data.url}`); } },
      });
    } catch (e: any) {
      toast.error(e.message || "Error al crear link");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="hidden md:table-cell">Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o.id)}>
                  <TableCell>
                    <p className="font-mono text-sm font-medium">#{o.number}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{o.customerName}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <p className="text-sm">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">{o.customerPhone}</p>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{formatMoney(o.total, o.currency)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${ORDER_STATUS_COLORS[o.status] ?? ""}`}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">No hay pedidos con este filtro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Pedido #{detail.number}
                  <span className={`text-xs rounded-full px-2 py-0.5 ${ORDER_STATUS_COLORS[detail.status] ?? ""}`}>{ORDER_STATUS_LABELS[detail.status]}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm space-y-1">
                  <p className="font-medium">{detail.customerName}</p>
                  <p className="text-muted-foreground">{detail.customerPhone}</p>
                  {detail.address && <p className="text-muted-foreground">{detail.address.line1}{detail.address.city ? `, ${detail.address.city}` : ""}</p>}
                  {detail.notes && <p className="text-xs italic text-muted-foreground">"{detail.notes}"</p>}
                </div>
                <Separator />
                <div className="space-y-2">
                  {detail.items.map((i) => (
                    <div key={i.id} className="flex justify-between text-sm">
                      <span>{i.name}{i.variantLabel ? ` (${i.variantLabel})` : ""} ×{i.quantity}</span>
                      <span className="font-medium">{formatMoney(i.total, detail.currency)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(detail.items.reduce((s, i) => s + i.total, 0), detail.currency)}</span></div>
                  {detail.discountTotal > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Descuento {detail.couponCode ? `(${detail.couponCode})` : ""}</span><span>-{formatMoney(detail.discountTotal, detail.currency)}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span>{formatMoney(detail.deliveryTotal, detail.currency)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(detail.total, detail.currency)}</span></div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Historial</p>
                  <div className="space-y-1.5">
                    {detail.history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px]">{ORDER_STATUS_LABELS[h.toStatus] ?? h.toStatus}</Badge>
                        <span className="text-muted-foreground">{h.actor} · {formatDateTime(h.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Select value={detail.status} onValueChange={(v) => handleStatus(detail.id, v)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_FLOW.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleCreateLink}><Link2 className="size-4 mr-1" /> Link de pago</Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(whatsappLink(detail.customerPhone, `Hola ${detail.customerName}, te contactamos por tu pedido #${detail.number}.`), "_blank")}>
                    <MessageCircle className="size-4 mr-1" /> WhatsApp
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
