import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Start = lazy(() => import("./pages/Start.tsx"));
const SuperAdmin = lazy(() => import("./pages/superadmin/SuperAdmin.tsx"));
const StoreAdmin = lazy(() => import("./pages/admin/StoreAdmin.tsx"));
const AdminProducts = lazy(() => import("./pages/admin/Products.tsx"));
const AdminCategories = lazy(() => import("./pages/admin/Categories.tsx"));
const AdminOrders = lazy(() => import("./pages/admin/Orders.tsx"));
const AdminCustomers = lazy(() => import("./pages/admin/Customers.tsx"));
const AdminDelivery = lazy(() => import("./pages/admin/Delivery.tsx"));
const AdminCoupons = lazy(() => import("./pages/admin/Coupons.tsx"));
const AdminTheme = lazy(() => import("./pages/admin/ThemeEditor.tsx"));
const AdminPages = lazy(() => import("./pages/admin/PageBuilder.tsx"));
const AdminSettings = lazy(() => import("./pages/admin/StoreSettings.tsx"));
const Storefront = lazy(() => import("./pages/storefront/Storefront.tsx"));
const StoreHome = lazy(() => import("./pages/storefront/Home.tsx"));
const StoreCatalog = lazy(() => import("./pages/storefront/Catalog.tsx"));
const StoreProduct = lazy(() => import("./pages/storefront/ProductPage.tsx"));
const StoreCart = lazy(() => import("./pages/storefront/CartPage.tsx"));
const StoreCheckout = lazy(() => import("./pages/storefront/CheckoutPage.tsx"));
const PayPage = lazy(() => import("./pages/storefront/PayPage.tsx"));
const OrderSuccess = lazy(() => import("./pages/storefront/OrderSuccess.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Cargando…</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage redirectAfterAuth="/start" />} />
              <Route path="/start" element={<Start />} />

              {/* Super Admin */}
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <SuperAdmin />
                  </RequireAuth>
                }
              />

              {/* Store Admin */}
              <Route path="/store" element={<RequireAuth><StoreAdmin /></RequireAuth>}>
                <Route index element={<AdminDashboardHome />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="delivery" element={<AdminDelivery />} />
                <Route path="coupons" element={<AdminCoupons />} />
                <Route path="theme" element={<AdminTheme />} />
                <Route path="pages" element={<AdminPages />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Storefront */}
              <Route path="/t/:slug" element={<Storefront />}>
                <Route index element={<StoreHome />} />
                <Route path="products" element={<StoreCatalog />} />
                <Route path="product/:productSlug" element={<StoreProduct />} />
                <Route path="cart" element={<StoreCart />} />
                <Route path="checkout" element={<StoreCheckout />} />
                <Route path="order-success" element={<OrderSuccess />} />
              </Route>

              {/* Hosted payment page */}
              <Route path="/pay/:token" element={<PayPage />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);

// Small inline dashboard home so the index route stays cheap
import { useQuery } from "convex/react";
import { api } from "./convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AdminDashboardHome() {
  const data = useQuery(api.analytics.storeDashboard);
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;
  const kpis = [
    { label: "Ingresos (total)", value: `S/ ${data.kpis.revenue.toFixed(2)}` },
    { label: "Pedidos", value: String(data.kpis.orders) },
    { label: "Pagos pendientes", value: String(data.kpis.pendingPayment) },
    { label: "Clientes", value: String(data.kpis.customers) },
    { label: "Productos", value: String(data.kpis.products) },
    { label: "Stock bajo", value: String(data.kpis.lowStock) },
  ];
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resumen</h1>
        <p className="text-sm text-muted-foreground mt-1">Últimos 30 días de actividad de tu tienda.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-1">
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="text-2xl">{k.value}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Embudo de conversión (30 días)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {data.funnel.map((f: any, i: number) => (
              <div key={f.label} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <div className="rounded-lg border bg-card px-3 py-2 text-center min-w-24">
                  <p className="text-lg font-semibold">{f.value}</p>
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
