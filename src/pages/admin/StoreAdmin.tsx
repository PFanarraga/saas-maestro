import { NavLink, Outlet, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Users, Truck, TicketPercent,
  Palette, LayoutTemplate, Settings, Store as StoreIcon, ExternalLink,
} from "lucide-react";

const NAV = [
  { to: "/store", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/store/products", label: "Productos", icon: Package },
  { to: "/store/categories", label: "Categorías", icon: FolderTree },
  { to: "/store/orders", label: "Pedidos", icon: ShoppingCart },
  { to: "/store/customers", label: "Clientes", icon: Users },
  { to: "/store/delivery", label: "Delivery", icon: Truck },
  { to: "/store/coupons", label: "Cupones", icon: TicketPercent },
  { to: "/store/theme", label: "Apariencia", icon: Palette },
  { to: "/store/pages", label: "Páginas", icon: LayoutTemplate },
  { to: "/store/settings", label: "Configuración", icon: Settings },
];

export default function StoreAdmin() {
  const { request } = useApi();
  const [access, setAccess] = useState<any>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    request<any>("/me/access").then(({ data }) => setAccess(data));
  }, [request]);

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background sticky top-0 z-20">
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <StoreIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none truncate">{access?.tenantName ?? "Mi tienda"}</p>
              <p className="text-xs text-muted-foreground">Panel de administración</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {access?.tenantSlug && (
              <Button variant="outline" size="sm" onClick={() => window.open(`/t/${access.tenantSlug}`, "_blank")}>
                <ExternalLink className="size-4 mr-1" /> Ver tienda
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate("/"))}>Salir</Button>
          </div>
        </div>
        <nav className="border-t bg-background overflow-x-auto">
          <div className="px-2 flex items-center gap-1 min-w-max">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
