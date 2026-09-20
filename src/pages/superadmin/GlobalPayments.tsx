import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, Calendar, AlertCircle, CheckCircle2,
  RotateCcw, History, ArrowDownRight, Search, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatMoney } from "@/lib/utils-shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  succeeded: { label: "Pagado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
  pending: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
  failed: { label: "Fallido", color: "text-rose-700", bg: "bg-rose-50 border-rose-100" },
  refunded: { label: "Reembolsado", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
};

export default function GlobalPayments() {
  const { request, isLoading } = useApi();
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    const { data } = await request<any[]>("/platform/payments");
    if (data) setPayments(data);
  };

  useEffect(() => { refresh(); }, [request]);

  const handleRefund = async (paymentId: string, amount: number) => {
    const reason = prompt("Motivo del reembolso:");
    if (!reason) return;

    const { error } = await request("/platform/payments/adjustment", {
      method: "POST",
      body: JSON.stringify({
        originalPaymentId: paymentId,
        amount: -Math.abs(amount),
        reason,
        type: 'refund'
      })
    });

    if (error) toast.error(error);
    else { toast.success("Ajuste de reembolso registrado"); refresh(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Historial de Pagos</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Libro contable inmutable de transacciones financieras.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm shadow-slate-200 overflow-hidden bg-white">
        <CardHeader className="border-b bg-white/50 pb-4">
           <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por tienda o ID..."
                  className="pl-10 bg-white h-10 border-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-10 text-[10px] font-bold uppercase tracking-widest bg-white">
                  <Filter className="size-3 mr-2" /> Filtrar Estados
                </Button>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tienda / Orden</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Monto</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">Proveedor</TableHead>
                <TableHead className="px-6 py-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const isAdjustment = p.provider === 'system_adjustment';
                const status = STATUS_MAP[p.status] || STATUS_MAP.pending;
                return (
                  <TableRow key={p.id} className={cn("hover:bg-slate-50/30 transition-colors border-slate-100", isAdjustment && "bg-slate-50/50 italic")}>
                    <TableCell className="px-6 py-4 text-[10px] font-bold text-slate-500">
                      {formatDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 leading-tight">{p.tenantName}</span>
                        <span className="text-[10px] text-slate-400 font-mono tracking-tighter">ORD #{p.orderNumber || p.id.slice(0,8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={cn("text-xs font-bold", p.amount < 0 ? "text-rose-600" : "text-slate-900")}>
                        {formatMoney(p.amount, p.currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", status.bg, status.color)}>
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {p.provider}
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      {!isAdjustment && p.status === 'succeeded' && (
                        <Button variant="ghost" size="icon" onClick={() => handleRefund(p.id, p.amount)} className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                          <RotateCcw className="size-3.5" />
                        </Button>
                      )}
                      {isAdjustment && <History className="size-3.5 text-slate-300 mx-auto" />}
                    </TableCell>
                  </TableRow>
                );
              })}
              {payments.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-24 text-center">
                    <DollarSign className="size-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin transacciones registradas</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
