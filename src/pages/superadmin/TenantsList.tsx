import { useMemo, useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Plus, Search, MoreVertical, ExternalLink,
  Trash2, ShieldAlert, CheckCircle2, Filter
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils-shared";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Activa", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
  suspended: { label: "Suspendida", color: "text-rose-700", bg: "bg-rose-50 border-rose-100" },
  draft: { label: "Borrador", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
};

export default function TenantsList() {
  const { request, isLoading } = useApi();
  const [tenants, setTenants] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    const { data } = await request<any[]>("/superadmin/tenants");
    if (data) setTenants(data);
  };

  useEffect(() => {
    refresh();
  }, [request]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return tenants;
    return tenants.filter(t => t.name.toLowerCase().includes(s) || t.slug.includes(s));
  }, [tenants, search]);

  const handleAction = async (tenant: any, action: string) => {
    if (action === 'delete') {
      if (!confirm(`¿Eliminar tienda "${tenant.name}" PERMANENTEMENTE?`)) return;
      const { error } = await request(`/superadmin/tenants/${tenant.id}`, { method: "DELETE" });
      if (error) toast.error(error); else { toast.success("Tienda eliminada"); refresh(); }
    }
    if (action === 'suspend') {
      const reason = prompt(`Motivo de suspensión de ${tenant.name}:`) ?? "Violación de términos";
      const { error } = await request(`/superadmin/tenants/${tenant.id}/status`, { method: "POST", body: JSON.stringify({ status: "suspended", reason }) });
      if (error) toast.error(error); else { toast.success("Tienda suspendida"); refresh(); }
    }
    if (action === 'activate') {
      const { error } = await request(`/superadmin/tenants/${tenant.id}/status`, { method: "POST", body: JSON.stringify({ status: "active" }) });
      if (error) toast.error(error); else { toast.success("Tienda reactivada"); refresh(); }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Tiendas</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Administra el ecosistema de clientes de Shoply.</p>
        </div>
        <Button className="font-bold text-xs shadow-lg shadow-primary/20">
          <Plus className="size-3.5 mr-2" /> NUEVA TIENDA
        </Button>
      </div>

      <Card className="border-none shadow-sm shadow-slate-200 overflow-hidden bg-white">
        <CardHeader className="border-b bg-white/50 pb-4">
           <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o slug..."
                  className="pl-10 bg-white h-10 border-slate-200"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="h-10 px-3 bg-white border-slate-200 text-xs font-bold text-slate-600">
                  <Filter className="size-3.5 mr-2 text-slate-400" /> FILTRAR
                </Button>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tienda</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Plan</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden md:table-cell">Creada</TableHead>
                <TableHead className="px-6 py-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/30 transition-colors group border-slate-100">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold border border-slate-200 group-hover:text-primary group-hover:border-primary/20 transition-all">
                         {t.name.charAt(0)}
                       </div>
                       <div>
                         <p className="text-sm font-bold text-slate-900 leading-tight">{t.name}</p>
                         <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{t.slug}.shoply.app</p>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px] font-bold uppercase border-slate-200", t.planCode === 'PRO' && "bg-indigo-50 text-indigo-700 border-indigo-100")}>
                      {t.planCode}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", STATUS_MAP[t.status]?.bg, STATUS_MAP[t.status]?.color)}>
                      <span className={cn("size-1.5 rounded-full mr-1.5", t.status === 'active' ? "bg-emerald-500" : "bg-rose-500")} />
                      {STATUS_MAP[t.status]?.label ?? t.status}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-slate-500 font-medium">
                    {formatDateTime(t.createdAt)}
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 hover:bg-slate-100"><MoreVertical className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 shadow-xl border-none">
                        <DropdownMenuItem onClick={() => window.open(`/t/${t.slug}`, "_blank")} className="text-[10px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer">
                          <ExternalLink className="size-3.5 mr-2 opacity-50" /> VER STOREFRONT
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-100" />
                        <DropdownMenuItem className="text-[10px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer">GESTIONAR PLAN</DropdownMenuItem>
                        {t.status === 'active' ? (
                          <DropdownMenuItem onClick={() => handleAction(t, 'suspend')} className="text-[10px] font-bold text-rose-600 focus:bg-rose-50 focus:text-rose-700 uppercase tracking-widest cursor-pointer">
                            <ShieldAlert className="size-3.5 mr-2" /> SUSPENDER TIENDA
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleAction(t, 'activate')} className="text-[10px] font-bold text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700 uppercase tracking-widest cursor-pointer">
                            <CheckCircle2 className="size-3.5 mr-2" /> REACTIVAR TIENDA
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-slate-100" />
                        <DropdownMenuItem onClick={() => handleAction(t, 'delete')} className="text-[10px] font-bold text-rose-600 focus:bg-rose-50 focus:text-rose-700 uppercase tracking-widest cursor-pointer">
                          <Trash2 className="size-3.5 mr-2" /> ELIMINAR PERMANENTE
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center">
                    <div className="mx-auto size-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                      <Building2 className="size-8 text-slate-200" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No se encontraron tiendas</p>
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
