import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Calendar, AlertCircle, CheckCircle2, XCircle,
  Clock, ArrowUpRight, DollarSign, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/utils-shared";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active: { label: "Activa", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
  trialing: { label: "Prueba", color: "text-blue-700", bg: "bg-blue-50 border-blue-100", icon: Clock },
  past_due: { label: "Vencida", color: "text-amber-700", bg: "bg-amber-50 border-amber-100", icon: AlertCircle },
  canceled: { label: "Cancelada", color: "text-rose-700", bg: "bg-rose-50 border-rose-100", icon: XCircle },
  incomplete: { label: "Incompleta", color: "text-slate-600", bg: "bg-slate-50 border-slate-200", icon: AlertCircle },
};

export default function SubscriptionsManagement() {
  const { request, isLoading } = useApi();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    request<any[]>("/platform/subscriptions").then(({ data }) => {
      if (data) setSubscriptions(data);
    });
  }, [request]);

  const stats = {
    active: subscriptions.filter(s => s.status === 'active').length,
    revenue: subscriptions.reduce((sum, s) => sum + (s.status === 'active' ? s.priceMonthly : 0), 0),
    mrr: subscriptions.reduce((sum, s) => sum + (s.status === 'active' ? s.priceMonthly : 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Suscripciones y Facturación</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Control contractual de las tiendas en la plataforma.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <Card className="border-none shadow-sm shadow-slate-200">
            <CardContent className="p-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">MRR ESTIMADO</p>
               <p className="text-2xl font-bold text-slate-900">{formatMoney(stats.mrr, 'USD')}</p>
               <p className="text-[10px] text-emerald-600 font-bold mt-1">BASADO EN {stats.active} ACTIVAS</p>
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm shadow-slate-200">
            <CardContent className="p-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">TASA DE CHURN</p>
               <p className="text-2xl font-bold text-slate-900">0.0%</p>
               <p className="text-[10px] text-slate-400 font-bold mt-1 tracking-tight">ÚLTIMOS 30 DÍAS</p>
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm shadow-slate-200">
            <CardContent className="p-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PAGOS PENDIENTES</p>
               <p className="text-2xl font-bold text-rose-600">0</p>
               <p className="text-[10px] text-rose-400 font-bold mt-1 tracking-tight">REQUIERE ATENCIÓN</p>
            </CardContent>
         </Card>
      </div>

      <Card className="border-none shadow-sm shadow-slate-200 overflow-hidden bg-white">
        <CardHeader className="border-b bg-white/50 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-widest">Listado Contractual</CardTitle>
            <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest">
              <Filter className="size-3 mr-2" /> Filtrar Estados
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tienda / Dueño</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Plan</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Precio</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">Inicio</TableHead>
                <TableHead className="px-6 py-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((s) => {
                const status = STATUS_MAP[s.status] || STATUS_MAP.incomplete;
                const StatusIcon = status.icon;
                return (
                  <TableRow key={s.id} className="hover:bg-slate-50/30 transition-colors border-slate-100 group">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 leading-tight">{s.tenantName}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.ownerEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase border-slate-200", s.planCode === 'PRO' && "bg-indigo-50 text-indigo-700 border-indigo-100")}>
                        {s.planCode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                        <DollarSign className="size-3 text-slate-300" />
                        {s.priceMonthly}
                        <span className="text-[10px] text-slate-400">/mes</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", status.bg, status.color)}>
                        <StatusIcon className="size-3 mr-1.5" />
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[10px] font-bold text-slate-400">
                      {formatDateTime(s.startedAt)}
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <Button variant="ghost" size="icon" className="size-8 hover:bg-slate-100 group-hover:text-primary transition-colors">
                        <ArrowUpRight className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {subscriptions.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-24 text-center">
                    <CreditCard className="size-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin suscripciones registradas</p>
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
