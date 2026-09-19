import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils-shared";
import { Id } from "@/convex/_generated/dataModel";

type Product = {
  _id: Id<"products">;
  name: string;
  sku?: string;
  price: number;
  comparePrice?: number;
  stock: number;
  status: string;
  featured: boolean;
  categoryName?: string | null;
};

const emptyForm = {
  id: undefined as Id<"products"> | undefined,
  name: "",
  sku: "",
  price: "",
  comparePrice: "",
  cost: "",
  stock: "0",
  status: "active" as "active" | "draft" | "archived",
  featured: false,
  categoryId: "" as string,
  shortDescription: "",
  description: "",
};

export default function AdminProducts() {
  const products = useQuery(api.catalog.listProducts, {});
  const categories = useQuery(api.catalog.listCategories, {});
  const save = useMutation(api.catalog.saveProduct);
  const remove = useMutation(api.catalog.deleteProduct);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    let items = (products ?? []) as Product[];
    const s = search.toLowerCase();
    if (s) items = items.filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s));
    if (statusFilter !== "all") items = items.filter((p) => p.status === statusFilter);
    return items;
  }, [products, search, statusFilter]);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (p: Product) => {
    setForm({
      id: p._id,
      name: p.name,
      sku: p.sku ?? "",
      price: String(p.price),
      comparePrice: p.comparePrice ? String(p.comparePrice) : "",
      cost: "",
      stock: String(p.stock),
      status: p.status as any,
      featured: p.featured,
      categoryId: (p as any).categoryId ?? "",
      shortDescription: "",
      description: "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      const price = parseFloat(form.price);
      if (!form.name.trim() || isNaN(price) || price < 0) {
        toast.error("Nombre y precio válido son obligatorios");
        return;
      }
      await save({
        id: form.id,
        name: form.name,
        sku: form.sku || undefined,
        price,
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        stock: parseInt(form.stock || "0", 10),
        status: form.status,
        featured: form.featured,
        categoryId: form.categoryId ? (form.categoryId as Id<"categories">) : undefined,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
      });
      toast.success(form.id ? "Producto actualizado" : "Producto creado");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
        <Button onClick={openNew}><Plus className="size-4 mr-1" /> Nuevo producto</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o SKU…" className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="archived">Archivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead className="hidden sm:table-cell">Stock</TableHead>
                <TableHead className="hidden sm:table-cell">Estado</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium leading-tight">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku ?? "—"}</p>
                      </div>
                      {p.featured && <Badge variant="outline" className="text-[10px]">★</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{p.categoryName ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {formatMoney(p.price)}
                    {p.comparePrice && <span className="ml-1 text-xs text-muted-foreground line-through">{formatMoney(p.comparePrice)}</span>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={p.stock === 0 ? "text-red-600 font-medium" : p.stock <= 5 ? "text-amber-600" : ""}>{p.stock}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={p.status === "active" ? "default" : "outline"} className="text-xs">
                      {p.status === "active" ? "Activo" : p.status === "draft" ? "Borrador" : "Archivado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => { if (confirm(`¿Eliminar "${p.name}"?`)) remove({ id: p._id }).then(() => toast.success("Eliminado")).catch((e) => toast.error(e.message)); }}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">No hay productos. Crea el primero.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Polo Oversized Basic" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Precio (S/) *</Label>
                <Input type="number" min="0" step="0.10" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Precio comparativo</Label>
                <Input type="number" min="0" step="0.10" value={form.comparePrice} onChange={(e) => setForm({ ...form, comparePrice: e.target.value })} placeholder="antes: 79.90" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Stock</Label>
                <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {(categories ?? []).map((c: any) => (
                      <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descripción corta</Label>
              <Input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} placeholder="Se muestra en las tarjetas de producto" />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Producto destacado</p>
                <p className="text-xs text-muted-foreground">Aparece en la sección de destacados del storefront</p>
              </div>
              <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Estado</p>
                <p className="text-xs text-muted-foreground">Los borradores no se ven en la tienda pública</p>
              </div>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{form.id ? "Guardar cambios" : "Crear producto"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
