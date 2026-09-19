import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

type Category = {
  _id: Id<"categories">;
  name: string;
  slug: string;
  parentId?: Id<"categories">;
};

export default function AdminCategories() {
  const categories = useQuery(api.catalog.listCategories, {}) as Category[] | undefined;
  const save = useMutation(api.catalog.saveCategory);
  const remove = useMutation(api.catalog.deleteCategory);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: undefined as Id<"categories"> | undefined, name: "", parentId: "" as string });

  const roots = (categories ?? []).filter((c) => !c.parentId);
  const childrenOf = (id: Id<"categories">) => (categories ?? []).filter((c) => c.parentId === id);

  const handleSave = async () => {
    try {
      if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
      await save({
        id: form.id,
        name: form.name,
        parentId: form.parentId ? (form.parentId as Id<"categories">) : undefined,
      });
      toast.success(form.id ? "Categoría actualizada" : "Categoría creada");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  const Row = ({ cat, depth }: { cat: Category; depth: number }) => (
    <>
      <div className="flex items-center justify-between rounded-lg border p-3" style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 min-w-0">
          {depth > 0 && <span className="text-muted-foreground">└</span>}
          <div className="min-w-0">
            <p className="font-medium truncate">{cat.name}</p>
            <p className="text-xs text-muted-foreground">/{cat.slug}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => { setForm({ id: cat._id, name: cat.name, parentId: cat.parentId ?? "" }); setOpen(true); }}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => { if (confirm(`¿Eliminar "${cat.name}"? Los productos quedarán sin categoría.`)) remove({ id: cat._id }).then(() => toast.success("Eliminada")).catch((e) => toast.error(e.message)); }}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {childrenOf(cat._id).map((child) => <Row key={child._id} cat={child} depth={depth + 1} />)}
    </>
  );

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
        <Button onClick={() => { setForm({ id: undefined, name: "", parentId: "" }); setOpen(true); }}><Plus className="size-4 mr-1" /> Nueva categoría</Button>
      </div>

      <div className="space-y-2 max-w-2xl">
        {roots.map((cat) => <Row key={cat._id} cat={cat} depth={0} />)}
        {roots.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <FolderTree className="mx-auto size-8 mb-2 text-muted-foreground/50" />
              Sin categorías aún. Crea la primera para organizar tu catálogo.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{form.id ? "Editar categoría" : "Nueva categoría"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ropa" />
            </div>
            <div className="space-y-1">
              <Label>Categoría padre</Label>
              <Select value={form.parentId || "root"} onValueChange={(v) => setForm({ ...form, parentId: v === "root" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">— Raíz —</SelectItem>
                  {(categories ?? []).filter((c) => c._id !== form.id).map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
