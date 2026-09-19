import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, MoreVertical, Plus, Search, ShieldCheck, LogOut, Users, Globe, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router";
import { formatDateTime, formatMoney } from "@/lib/utils-shared";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string;
  whatsappPhone?: string;
  isDemo?: boolean;
  createdAt: number;
};

export default function SuperAdmin() {
  const { user, signOut } = useAuth();
  const { request } = useApi();
  const navigate = useNavigate();
  const isSuperAdmin = user?.platformRole === "super_admin";

  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [plans, setPlans] = useState<any[] | null>(null);
  const [orders, setOrders] = useState<any[] | null>(null);
  const [logs, setLogs] = useState<any[] | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    refreshData();
  }, [isSuperAdmin]);

  const refreshData = async () => {
    request<any>("/platform/global-stats").then(({ data }) => setStats(data));
    request<Tenant[]>("/superadmin/tenants").then(({ data }) => setTenants(data));
    request<any[]>("/platform/plans").then(({ data }) => setPlans(data));
    request<any[]>("/platform/global-orders").then(({ data }) => setOrders(data));
    request<any[]>("/platform/audit-logs").then(({ data }) => setLogs(data));
  };

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", template: "minimal", planCode: "BASIC", adminEmail: "", adminName: "", whatsappPhone: "" });

  const filtered = useMemo(() => {
    if (!tenants) return [];
    const s = search.toLowerCase();
    return tenants.filter((t: Tenant) => t.name.toLowerCase().includes(s) || t.slug.includes(s));
  }, [tenants, search]);

  if (!isSuperAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esta área es solo para el Super Admin de la plataforma.
            <Button variant="outline" className="mt-4 w-full" onClick={() => navigate("/start")}>Volver</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const kpis = [
    { label: "Tiendas", value: stats?.tenants ?? "…", icon: Building2 },
    { label: "Activas", value: stats?.activeTenants ?? "…", icon: Globe },
    { label: "Usuarios", value: stats?.users ?? "…", icon: Users },
    { label: "Pedidos globales", value: stats?.orders ?? "…", icon: ClipboardList },
    { label: "Ingresos GMV", value: stats ? formatMoney(stats.revenue) : "…", icon: ClipboardList },
  ];

  const handleCreate = async () => {
    try {
      if (!form.name.trim() || !form.slug.trim() || !form.adminEmail.trim()) {
        toast.error("Nombre, slug y email del administrador son obligatorios");
        return;
      }
      const { error } = await request("/superadmin/tenants", {
        method: "POST",
        body: JSON.stringify({ ...form, slug: form.slug.toLowerCase().trim() })
      });
      if (error) throw new Error(error);
      toast.success(`Tienda "${form.name}" creada`);
      setOpen(false);
      setForm({ name: "", slug: "", template: "minimal", planCode: "BASIC", adminEmail: "", adminName: "", whatsappPhone: "" });
      refreshData();
    } catch (e: any) {
      toast.error(e.message || "Error al crear tienda");
    }
  };

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Shoply Platform</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              const { error } = await request("/admin/seed-demo-data", { method: "POST" });
              if (error) toast.error(error); else { toast.success("Datos demo creados"); refreshData(); }
            }}>
              <Plus className="size-4 mr-1" /> Datos demo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>
              <LogOut className="size-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <k.icon className="size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-lg font-semibold leading-tight">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="tenants">
          <TabsList>
            <TabsTrigger value="tenants">Tiendas</TabsTrigger>
            <TabsTrigger value="plans">Planes</TabsTrigger>
            <TabsTrigger value="orders">Pedidos globales</TabsTrigger>
            <TabsTrigger value="audit">Auditoría</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tienda…" className="pl-8" />
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="size-4 mr-1" /> Nueva tienda</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Crear nueva tienda</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Nombre</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mi Tienda" />
                    </div>
                    <div className="space-y-1">
                      <Label>Slug (subdominio)</Label>
                      <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="mi-tienda" />
                      <p className="text-xs text-muted-foreground">{form.slug || "mi-tienda"}.shoply.app</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Plantilla</Label>
                        <Select value={form.template} onValueChange={(v) => setForm({ ...form, template: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minimal">Minimal</SelectItem>
                            <SelectItem value="vibrant">Vibrante</SelectItem>
                            <SelectItem value="classic">Clásica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Plan</Label>
                        <Select value={form.planCode} onValueChange={(v) => setForm({ ...form, planCode: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(plans ?? ["FREE", "BASIC", "PRO", "BUSINESS", "ENTERPRISE"]).map((p: any) => (
                              <SelectItem key={p.code ?? p} value={p.code ?? p}>{p.code ?? p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Email administrador</Label>
                        <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="admin@tienda.com" />
                      </div>
                      <div className="space-y-1">
                        <Label>WhatsApp</Label>
                        <Input value={form.whatsappPhone} onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })} placeholder="51987654321" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">La tienda se crea activa con theme, página de inicio, subdominio y zona de delivery. El administrador podrá ingresar con su email (código OTP).</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreate}>Crear tienda</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tienda</TableHead>
                      <TableHead className="hidden md:table-cell">Plan</TableHead>
                      <TableHead className="hidden sm:table-cell">Estado</TableHead>
                      <TableHead className="hidden lg:table-cell">Creada</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t: Tenant) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium leading-tight">
                                {t.name}
                                {t.isDemo && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 rounded px-1.5 py-0.5">demo</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">{t.slug}.shoply.app</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><Badge variant="outline">{t.planCode}</Badge></TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_BADGE[t.status] ?? ""}`}>{t.status === "active" ? "Activa" : t.status === "suspended" ? "Suspendida" : t.status}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/t/${t.slug}`, "_blank")}>Ver storefront</DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                const code = prompt(`Nuevo plan para ${t.name}:`, t.planCode);
                                if (code) {
                                  const { error } = await request(`/superadmin/tenants/${t.id}/plan`, { method: "POST", body: JSON.stringify({ planCode: code }) });
                                  if (error) toast.error(error); else { toast.success("Plan actualizado"); refreshData(); }
                                }
                              }}>Cambiar plan</DropdownMenuItem>
                              {t.status === "active" ? (
                                <DropdownMenuItem className="text-red-600" onClick={async () => {
                                  const reason = prompt(`Motivo de suspensión de ${t.name}:`) ?? "Violación de términos";
                                  const { error } = await request(`/superadmin/tenants/${t.id}/status`, { method: "POST", body: JSON.stringify({ status: "suspended", reason }) });
                                  if (error) toast.error(error); else { toast.success("Tienda suspendida"); refreshData(); }
                                }}>Suspender</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={async () => {
                                  const { error } = await request(`/superadmin/tenants/${t.id}/status`, { method: "POST", body: JSON.stringify({ status: "active" }) });
                                  if (error) toast.error(error); else { toast.success("Tienda reactivada"); refreshData(); }
                                }}>Reactivar</DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-red-600" onClick={async () => {
                                if (confirm(`¿Eliminar tienda "${t.name}" PERMANENTEMENTE?`)) {
                                  const { error } = await request(`/superadmin/tenants/${t.id}`, { method: "DELETE" });
                                  if (error) toast.error(error); else { toast.success("Tienda eliminada"); refreshData(); }
                                }
                              }}>Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">No hay tiendas aún. Crea la primera o carga datos demo.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(plans ?? []).map((p: any) => (
                <Card key={p.code}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <p className="text-2xl font-bold">${p.priceMonthly}<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <p>{p.limits.maxProducts} productos · {p.limits.maxStaff} staff</p>
                    <p>{p.limits.customDomain ? "Dominio propio ✓" : "Sin dominio propio"}</p>
                    <p>{p.limits.analytics ? "Analytics ✓" : "Sin analytics"} · {p.limits.coupons ? "Cupones ✓" : "Sin cupones"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Tienda</TableHead>
                      <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="hidden md:table-cell">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(orders ?? []).map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">#{o.number}</TableCell>
                        <TableCell className="text-sm">{o.tenantName}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{o.customerName}</TableCell>
                        <TableCell className="text-sm">{formatMoney(o.total, o.currency)}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{o.status}</TableCell>
                      </TableRow>
                    ))}
                    {(orders ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Sin pedidos aún.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Acción</TableHead>
                      <TableHead className="hidden sm:table-cell">Recurso</TableHead>
                      <TableHead className="hidden md:table-cell">Actor</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logs ?? []).slice(0, 50).map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell><Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge></TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{l.resource}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{l.actorLabel}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {(logs ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-10">Sin registros de auditoría.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
