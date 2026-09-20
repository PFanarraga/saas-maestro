import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Clock, AlertCircle, CheckCircle2,
  User, Store, ArrowRight, Filter, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils-shared";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Abierto", color: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
  in_progress: { label: "En Proceso", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-100" },
  waiting_customer: { label: "Esperando Cliente", color: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
  resolved: { label: "Resuelto", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
  closed: { label: "Cerrado", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "Baja", color: "text-slate-500" },
  normal: { label: "Normal", color: "text-blue-500" },
  high: { label: "Alta", color: "text-amber-600" },
  urgent: { label: "Urgente", color: "text-rose-600" },
};

export default function SupportCenter() {
  const { request, isLoading } = useApi();
  const [tickets, setTickets] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    request<any[]>("/platform/support/tickets").then(({ data }) => {
      if (data) setTickets(data);
    });
  }, [request]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Centro de Soporte</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Gestiona las incidencias y consultas de los clientes de Shoply.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm shadow-slate-200 overflow-hidden bg-white">
        <CardHeader className="border-b bg-white/50 pb-4">
           <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input placeholder="Buscar por asunto o ticket #..." className="pl-10 h-10 border-slate-200" />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-10 text-[10px] font-bold bg-white">
                  <Filter className="size-3 mr-2" /> PRIORIDAD
                </Button>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ticket # / Asunto</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Prioridad</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tienda</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">Última act.</TableHead>
                <TableHead className="px-6 py-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/30 transition-colors border-slate-100 group cursor-pointer" onClick={() => navigate(`/admin/support/${t.id}`)}>
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col max-w-[300px]">
                      <span className="text-[10px] font-bold text-primary mb-0.5 tracking-tighter">TK-{t.ticketNumber}</span>
                      <span className="text-sm font-bold text-slate-900 leading-tight truncate">{t.subject}</span>
                      <span className="text-[10px] text-slate-400 truncate">{t.userName || t.userEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn("text-[10px] font-bold flex items-center gap-1.5", PRIORITY_MAP[t.priority]?.color)}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {PRIORITY_MAP[t.priority]?.label.toUpperCase()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", STATUS_MAP[t.status]?.bg, STATUS_MAP[t.status]?.color)}>
                      {STATUS_MAP[t.status]?.label}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                      <Store className="size-3 text-slate-300" />
                      {t.tenantName || 'Plataforma'}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-[10px] font-bold text-slate-400">
                    {formatDateTime(t.updatedAt)}
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <Button variant="ghost" size="icon" className="size-8 group-hover:text-primary transition-colors">
                      <ArrowRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {tickets.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-24 text-center">
                    <MessageSquare className="size-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin tickets pendientes</p>
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
