import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils-shared";
import { Search, History, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AuditLogs() {
  const { request, isLoading } = useApi();
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    const { data } = await request<any[]>("/platform/audit-logs");
    if (data) setLogs(data);
  };

  useEffect(() => {
    refresh();
  }, [request]);

  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.actorLabel.toLowerCase().includes(search.toLowerCase()) ||
    l.resource.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Registro de Auditoría</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Historial de acciones críticas en la plataforma.</p>
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
                  placeholder="Buscar por acción, actor o recurso..."
                  className="pl-10 bg-white h-10 border-slate-200"
                />
              </div>
              <Button variant="outline" size="sm" className="h-10 px-3 bg-white border-slate-200 text-xs font-bold text-slate-600">
                <Filter className="size-3.5 mr-2 text-slate-400" /> FILTRAR POR FECHA
              </Button>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha y Hora</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Actor</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Acción</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Recurso</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">ID Recurso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id} className="hover:bg-slate-50/30 transition-colors border-slate-100">
                  <TableCell className="px-6 py-4 text-xs font-bold text-slate-500">
                    {formatDateTime(l.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <div className="size-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 uppercase">
                         {l.actorLabel.charAt(0)}
                       </div>
                       <span className="text-xs font-bold text-slate-900">{l.actorLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-slate-50 text-slate-600 border-slate-200">
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-slate-600 capitalize">{l.resource}</span>
                  </TableCell>
                  <TableCell className="px-6 text-[10px] font-mono text-slate-400 hidden lg:table-cell">
                    {l.resourceId || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center">
                    <History className="size-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin registros de actividad</p>
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
