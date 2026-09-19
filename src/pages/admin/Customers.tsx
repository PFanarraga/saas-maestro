import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { formatDateTime, formatMoney } from "@/lib/utils-shared";
import { Id } from "@/convex/_generated/dataModel";

type Customer = {
  _id: Id<"customers">;
  name: string;
  email?: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: number;
};

type CustomerDetail = Customer & {
  orders: Array<{ _id: string; number: string; status: string; total: number; currency: string; createdAt: number }>;
};

export default function AdminCustomers() {
  const customers = useQuery(api.store.listCustomers, {}) as Customer[] | undefined;
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Id<"customers"> | null>(null);
  const detail = useQuery(api.store.getCustomer, selected ? { id: selected } : "skip") as CustomerDetail | undefined;

  const filtered = useMemo(() => {
    const items = customers ?? [];
    const s = search.toLowerCase();
    if (!s) return items;
    return items.filter((c) => c.name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s) || (c.phone ?? "").includes(s));
  }, [customers, search]);

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" className="pl-8" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Contacto</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Total gastado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c._id} className="cursor-pointer" onClick={() => setSelected(c._id)}>
                  <TableCell>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Desde {formatDateTime(c.createdAt)}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {c.email ?? "—"}
                    <br />
                    {c.phone ?? ""}
                  </TableCell>
                  <TableCell className="text-right text-sm">{c.totalOrders}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatMoney(c.totalSpent)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">Sin clientes todavía.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.name}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">{detail.email ?? "Sin email"} · {detail.phone ?? "Sin teléfono"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-xl font-semibold">{detail.totalOrders}</p><p className="text-xs text-muted-foreground">Pedidos</p></CardContent></Card>
                  <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-xl font-semibold">{formatMoney(detail.totalSpent)}</p><p className="text-xs text-muted-foreground">Gastado</p></CardContent></Card>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Historial de pedidos</p>
                  <div className="space-y-1.5">
                    {detail.orders.map((o) => (
                      <div key={o._id} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                        <span className="font-mono">#{o.number}</span>
                        <span>{formatMoney(o.total, o.currency)}</span>
                      </div>
                    ))}
                    {detail.orders.length === 0 && <p className="text-xs text-muted-foreground">Sin pedidos.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
