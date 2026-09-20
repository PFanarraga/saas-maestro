import { NavLink, Outlet, useNavigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Users, CreditCard, ShoppingCart,
  Settings, ShieldCheck, LogOut, BarChart3, History, Flag, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_GROUPS = [
  {
    label: "GENERAL",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    ]
  },
  {
    label: "NEGOCIO",
    items: [
      { to: "/admin/tenants", label: "Tiendas", icon: Building2, end: false },
      { to: "/admin/users", label: "Usuarios", icon: Users, end: false },
      { to: "/admin/subscriptions", label: "Suscripciones", icon: History, end: false },
    ]
  },
  {
    label: "OPERACIONES",
    items: [
      { to: "/admin/payments", label: "Pagos", icon: CreditCard, end: false },
      { to: "/admin/support", label: "Soporte", icon: MessageSquare, end: false },
    ]
  },
  {
    label: "ANALÍTICA",
    items: [
      { to: "/admin/analytics", label: "Analítica", icon: BarChart3, end: false },
      { to: "/admin/audit", label: "Auditoría", icon: History, end: false },
    ]
  },
  {
    label: "PLATAFORMA",
    items: [
      { to: "/admin/settings", label: "Configuración", icon: Settings, end: false },
      { to: "/admin/flags", label: "Feature Flags", icon: Flag, end: false },
    ]
  }
];

export default function SuperAdminLayout() {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) return null;
  if (user?.platformRole !== "super_admin") {
    return null;
  }

  const sectionName = (() => {
    const path = location.pathname;
    if (path === "/admin") return "Dashboard";
    const segment = path.split("/").pop();
    if (!segment) return "Dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  })();

  return (
    <div className="flex min-h-screen bg-slate-50/80">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r bg-white lg:block z-40">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6 gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <ShieldCheck className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-slate-900">SHOPLY</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Platform</span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-4 scrollbar-hide">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-6">
                <h3 className="mb-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.label}</h3>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-all",
                          isActive
                            ? "bg-slate-100 text-primary shadow-sm ring-1 ring-slate-200"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        )
                      }
                    >
                      <item.icon className={cn("size-4 transition-opacity", location.pathname === item.to ? "opacity-100" : "opacity-60")} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t p-4 bg-slate-50/50">
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {user.name?.charAt(0) ?? "A"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-900 truncate leading-none mb-1">{user.name ?? "Super Admin"}</span>
                <span className="text-[10px] font-medium text-slate-500 truncate">{user.email}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => signOut().then(() => navigate("/"))}
            >
              <LogOut className="mr-2 size-4" /> SALIR DE PLATAFORMA
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
               {sectionName}
            </h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 gap-2">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sistemas Activos</span>
             </div>
             <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-400">
               <ShieldCheck className="size-4" />
             </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
