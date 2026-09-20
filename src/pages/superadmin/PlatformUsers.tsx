import { useState, useEffect, useMemo } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, User, ShieldCheck, ShieldAlert, Lock, Unlock,
  MoreVertical, Store, UserCog, Mail, CheckCircle2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils-shared";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  owner: "Propietario",
  staff: "Trabajador",
  customer: "Comprador",
};

export default function PlatformUsers() {
  const { request, isLoading } = useApi();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    const { data } = await request<any[]>("/platform/users");
    if (data) setUsers(data);
  };

  useEffect(() => { refresh(); }, [request]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return users;
    return users.filter(u =>
      u.email?.toLowerCase().includes(s) ||
      u.name?.toLowerCase().includes(s) ||
      u.firstName?.toLowerCase().includes(s) ||
      u.lastName?.toLowerCase().includes(s)
    );
  }, [users, search]);

  const handleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    const { error } = await request(`/platform/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus })
    });
    if (error) toast.error(error);
    else {
      toast.success(newStatus === 'blocked' ? "Usuario bloqueado" : "Usuario activado");
      refresh();
    }
  };

  const handleRole = async (userId: string, newRole: string | null) => {
    if (newRole === 'super_admin') return;
    const { error } = await request(`/platform/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole })
    });
    if (error) toast.error(error);
    else {
      toast.success("Rol actualizado");
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Control de identidades y accesos de toda la plataforma.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm shadow-slate-200 overflow-hidden bg-white">
        <CardHeader className="border-b bg-white/50 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-3 size-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por email o nombre..."
              className="pl-10 bg-white h-10 border-slate-200"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Usuario</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Rol Plataforma</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tiendas</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</TableHead>
                <TableHead className="py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hidden lg:table-cell">Creado</TableHead>
                <TableHead className="px-6 py-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="hover:bg-slate-50/30 transition-colors border-slate-100 group">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className={cn(
                         "size-10 rounded-xl flex items-center justify-center font-bold border transition-all",
                         u.platformRole === 'super_admin' ? "bg-slate-900 text-white border-slate-900" : "bg-slate-100 text-slate-400 border-slate-200"
                       )}>
                         {u.platformRole === 'super_admin' ? <ShieldCheck className="size-5" /> : (u.name?.charAt(0) || u.email?.charAt(0) || "?")}
                       </div>
                       <div className="flex flex-col min-w-0">
                         <span className="text-sm font-bold text-slate-900 leading-tight truncate">
                           {u.name || (u.firstName ? `${u.firstName} ${u.lastName}` : "Sin nombre")}
                         </span>
                         <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                           <Mail className="size-2.5" /> {u.email}
                         </span>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.platformRole === 'super_admin' ? 'default' : 'outline'} className="text-[9px] font-black uppercase tracking-tighter">
                      {ROLE_LABELS[u.platformRole] || "Cliente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                      <Store className="size-3.5 text-slate-300" />
                      {u.tenantCount} {u.tenantCount === 1 ? 'tienda' : 'tiendas'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      u.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                    )}>
                      {u.status === 'active' ? <CheckCircle2 className="size-3 mr-1" /> : <ShieldAlert className="size-3 mr-1" />}
                      {u.status === 'active' ? 'ACTIVO' : 'BLOQUEADO'}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-[10px] font-bold text-slate-400">
                    {formatDateTime(u.createdAt)}
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    {u.platformRole !== 'super_admin' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 hover:bg-slate-100"><MoreVertical className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 shadow-xl border-none">
                          <DropdownMenuItem onClick={() => handleStatus(u.id, u.status)} className={cn("text-[10px] font-bold uppercase tracking-widest cursor-pointer", u.status === 'active' ? "text-rose-600" : "text-emerald-600")}>
                            {u.status === 'active' ? <><Lock className="size-3.5 mr-2" /> BLOQUEAR ACCESO</> : <><Unlock className="size-3.5 mr-2" /> DESBLOQUEAR</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-100" />
                          <DropdownMenuItem onClick={() => handleRole(u.id, 'owner')} className="text-[10px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer">
                            <UserCog className="size-3.5 mr-2 opacity-50" /> ASIGNAR ROL OWNER
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRole(u.id, null)} className="text-[10px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer">
                            <User className="size-3.5 mr-2 opacity-50" /> QUITAR ROLES
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
