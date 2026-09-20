import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, ShoppingCart, TrendingUp,
  Clock, AlertTriangle, CheckCircle2, Plus, RefreshCw
} from "lucide-react";
import { RevenueChart, PlanDistribution } from "./components/DashboardCharts";
import { formatMoney, formatDateTime } from "@/lib/utils-shared";
import { motion } from "framer-motion";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export default function PlatformDashboard() {
  const { request, isLoading } = useApi();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);

  const refresh = async () => {
    const { data: stats } = await request<any>("/platform/global-stats");
    if (stats) setData(stats);
  };

  useEffect(() => {
    refresh();
  }, [request]);

  const kpis = [
    { label: "Tiendas", value: data?.tenants, sub: `+${data?.growth?.newTenants30d || 0} últimos 30d`, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pedidos", value: data?.orders, sub: `+${data?.growth?.newOrders30d || 0} últimos 30d`, icon: ShoppingCart, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "GMV Total", value: data ? formatMoney(data.revenue) : null, sub: `${formatMoney(data?.growth?.revenue30d || 0)} este mes`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Usuarios", value: data?.users, sub: "Clientes registrados", icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  if (isLoading && !data) {
    return <div className="space-y-8 animate-pulse">
      <div className="h-16 bg-slate-200 rounded-xl w-64" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[400px] bg-slate-200 rounded-xl" />
        <div className="h-[400px] bg-slate-200 rounded-xl" />
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Buenos días, {user?.name?.split(' ')[0] ?? "Pedro"}</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Aquí tienes el resumen de Shoply Platform.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={refresh} className="h-9 font-bold text-xs bg-white">
             <RefreshCw className={cn("size-3.5 mr-2", isLoading && "animate-spin")} /> ACTUALIZAR
           </Button>
           <Button size="sm" className="h-9 font-bold text-xs shadow-lg shadow-primary/20" asChild>
             <Link to="/admin/tenants"><Plus className="size-3.5 mr-2" /> NUEVA TIENDA</Link>
           </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-none shadow-sm shadow-slate-200 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-2 rounded-lg", k.bg, k.color)}>
                    <k.icon className="size-5" />
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Global</div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-slate-900">{k.value ?? "—"}</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">{k.label}</p>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">{k.sub}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm shadow-slate-200">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-white/50">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">GMV / VENTAS REALES</CardTitle>
              <CardDescription className="text-xs">Rendimiento de los últimos 14 días</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold border-slate-200 bg-white">MÉTRICA GLOBAL</Badge>
          </CardHeader>
          <CardContent className="pt-6">
            <RevenueChart data={data?.chartSeries ?? []} />
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="border-none shadow-sm shadow-slate-200">
          <CardHeader className="border-b pb-4 bg-white/50">
            <CardTitle className="text-sm font-bold text-slate-900">DISTRIBUCIÓN DE PLANES</CardTitle>
            <CardDescription className="text-xs">Suscripciones por nivel</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <PlanDistribution data={data?.planDistribution ?? {}} />
            <div className="mt-6 space-y-2.5">
               {Object.entries(data?.planDistribution ?? {}).sort((a,b) => (b[1] as number) - (a[1] as number)).map(([plan, count]: any, i) => (
                 <div key={plan} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                       <span className={cn("size-2 rounded-full shadow-sm", i === 0 ? "bg-blue-500" : i === 1 ? "bg-indigo-500" : "bg-slate-300")} />
                       <span className="font-bold text-slate-600 uppercase tracking-tight">{plan}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="font-bold text-slate-900">{count}</span>
                       <span className="text-[10px] text-slate-400 font-medium">TIENDAS</span>
                    </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
         {/* Recent Tenants */}
         <Card className="border-none shadow-sm shadow-slate-200">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-white/50">
              <CardTitle className="text-sm font-bold text-slate-900">TIENDAS RECIENTES</CardTitle>
              <Button variant="ghost" size="sm" className="text-[10px] font-bold text-primary h-7 px-2 hover:bg-primary/5" asChild>
                <Link to="/admin/tenants">VER TODAS</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {(data?.recent?.tenants ?? []).map((t: any) => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{t.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{t.slug}.shoply.app</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <Badge variant="outline" className={cn("text-[9px] h-5 mb-1 border-slate-200 font-bold", t.planCode === 'PRO' && "bg-indigo-50 text-indigo-700 border-indigo-100")}>{t.planCode}</Badge>
                       <p className="text-[10px] text-slate-400 font-medium">{formatDateTime(t.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {(data?.recent?.tenants ?? []).length === 0 && (
                  <div className="p-12 text-center text-slate-400 text-xs italic">Aún no hay tiendas registradas</div>
                )}
              </div>
            </CardContent>
         </Card>

         {/* System State */}
         <Card className="border-none shadow-sm shadow-slate-200">
            <CardHeader className="border-b pb-4 bg-white/50">
              <CardTitle className="text-sm font-bold text-slate-900">SITUACIÓN DE PLATAFORMA</CardTitle>
              <CardDescription className="text-xs">Estado de salud de Shoply</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
               <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 shadow-inner">
                  <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Infraestructura operativa</p>
                    <p className="text-[11px] text-slate-500 leading-normal mt-0.5">Cloudflare Pages y Supabase Edge Functions respondiendo dentro de los parámetros normales.</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Requiere Atención</h4>
                  <div className="space-y-2">
                    {data?.suspendedTenants > 0 ? (
                      <div className="flex items-center justify-between p-3 rounded-lg border border-rose-100 bg-rose-50/50">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="size-4 text-rose-600" />
                          <span className="text-xs font-bold text-rose-900">{data.suspendedTenants} TIENDAS SUSPENDIDAS</span>
                        </div>
                        <Button variant="link" size="sm" className="text-[10px] h-auto p-0 text-rose-700 font-bold hover:no-underline" asChild>
                          <Link to="/admin/tenants?status=suspended">REVISAR</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 text-slate-400">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span className="text-[11px] font-medium uppercase tracking-tight">Sin tiendas suspendidas</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100">
                      <Clock className="size-4 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Sincronización remota activa</span>
                    </div>
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
