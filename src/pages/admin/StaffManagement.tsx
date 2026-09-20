import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Trash2, Key, Loader2, User } from "lucide-react";

export default function StaffManagement() {
  const { request } = useApi();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);

  const fetchStaff = async () => {
    const { data } = await request<any[]>("/store/staff");
    if (data) setStaff(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, [request]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await request("/store/staff", {
        method: "POST",
        body: JSON.stringify({ ...form, role: 'staff' })
      });
      if (error) throw new Error(error);
      toast.success("Trabajador creado exitosamente");
      setOpen(false);
      setForm({ username: "", password: "", name: "" });
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Error al crear trabajador");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este trabajador? Perderá acceso inmediato.")) return;
    const { error } = await request(`/store/staff/${id}`, { method: "DELETE" });
    if (error) toast.error(error);
    else { toast.success("Trabajador eliminado"); fetchStaff(); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Equipo de Trabajo</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona los accesos de tus vendedores y administradores.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="shadow-lg shadow-primary/20">
          <UserPlus className="size-4 mr-2" /> Agregar Trabajador
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold">Usuarios del Panel</CardTitle>
          <CardDescription>Los trabajadores creados aquí podrán entrar desde el link de tu tienda + /staff</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[200px]">Nombre</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="hidden md:table-cell">Invitación / Email</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((m) => (
                <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {m.userName?.charAt(0) || m.userEmail.charAt(0)}
                      </div>
                      {m.userName || "Pendiente"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.username ? <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">{m.username}</code> : <span className="text-xs text-slate-400">Vía Email</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'owner' ? 'default' : 'outline'} className="capitalize text-[10px]">
                      {m.role === 'owner' ? 'Propietario' : 'Vendedor'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-slate-500">
                    {m.userEmail}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.role !== 'owner' && (
                      <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && !loading && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-400">Sin trabajadores asignados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Trabajador</DialogTitle>
            <CardDescription>Crea un usuario para que tu equipo pueda gestionar la tienda.</CardDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold uppercase text-slate-500 ml-1">Nombre Completo</Label>
              <Input id="name" placeholder="Ej: Juan Pérez" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="user" className="text-xs font-semibold uppercase text-slate-500 ml-1">Usuario</Label>
                <Input id="user" placeholder="vendedor1" value={form.username} onChange={e => setForm({...form, username: e.target.value.replace(/\s+/g, '')})} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pass" className="text-xs font-semibold uppercase text-slate-500 ml-1">Contraseña</Label>
                <Input id="pass" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3">
              <Key className="size-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 leading-tight">
                El trabajador podrá ingresar usando solo su nombre de usuario y esta contraseña desde la página de tu tienda.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin size-4" /> : "Crear Usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
