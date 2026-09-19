import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router";
import { useApi } from "@/hooks/use-api";
import { ShoppingBag, MessageCircle } from "lucide-react";
import { formatMoney, whatsappLink, type ThemeConfig } from "@/lib/utils-shared";

export function useStoreSession(slug?: string) {
  return `${slug ?? "s"}-${(() => {
    const k = "shoply_session_key";
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  })()}`;
}

export default function Storefront() {
  const { slug } = useParams<{ slug: string }>();
  const { request } = useApi();
  const [tenant, setTenant] = useState<any>(undefined);
  const [themeData, setThemeData] = useState<any>(null);
  const [cart, setCart] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    if (!slug) return;
    request<any>(`/public/tenants/${slug}`).then(({ data }) => setTenant(data));
    request<any>(`/public/tenants/${slug}/theme`).then(({ data }) => setThemeData(data));
  }, [slug, request]);

  const sessionKey = useStoreSession(slug);

  useEffect(() => {
    if (!slug) return;
    request<any>(`/cart?slug=${slug}&sessionKey=${sessionKey}`).then(({ data }) => setCart(data));
  }, [slug, sessionKey, request, location.pathname]);

  useEffect(() => {
    if (slug) request(`/public/tenants/${slug}/events`, {
      method: "POST",
      body: JSON.stringify({ type: "page_view", path: location.pathname, sessionId: sessionKey })
    }).catch(() => undefined);
  }, [slug, location.pathname, sessionKey, request]);

  const theme = (themeData?.theme ?? null) as ThemeConfig | null;
  const c = theme?.colors ?? {};
  const styleVars = {
    "--sf-bg": c.background ?? "#ffffff",
    "--sf-fg": c.foreground ?? "#111111",
    "--sf-card": c.card ?? "#fafafa",
    "--sf-muted": c.muted ?? "#f5f5f5",
    "--sf-muted-fg": c.mutedForeground ?? "#6b7280",
    "--sf-primary": c.primary ?? "#111111",
    "--sf-primary-fg": c.primaryForeground ?? "#ffffff",
    "--sf-border": c.border ?? "#e5e7eb",
    "--sf-radius": c.radius ?? "0.5rem",
    fontFamily: theme?.typography?.body ?? "Inter",
  } as React.CSSProperties;

  const sessionKey = useStoreSession(slug);
  const cart = useQuery(api.cart.getCart, slug ? { slug, sessionKey } : "skip");

  if (tenant === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold">Tienda no disponible</p>
        <p className="text-sm text-muted-foreground">Esta tienda no existe o fue suspendida.</p>
      </div>
    );
  }
  if (!tenant) return <div className="min-h-screen" />;

  return (
    <div style={styleVars} className="sf-scope min-h-screen flex flex-col">
      {theme?.header?.announcement && (
        <div className="sf-announcement px-4 py-2 text-center text-xs">{theme.header.announcement}</div>
      )}
      <header className="sf-header sticky top-0 z-30 border-b">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
          <Link to={`/t/${slug}`} className="flex items-center gap-2 min-w-0">
            {theme?.brand?.logoUrl ? (
              <img src={theme.brand.logoUrl} alt={tenant.name} className="h-7 w-auto" />
            ) : (
              <span className="sf-logo-badge flex size-7 items-center justify-center text-xs font-bold">{(theme?.brand?.name ?? tenant.name).charAt(0)}</span>
            )}
            <span className="font-bold truncate" style={{ fontFamily: theme?.typography?.heading }}>{theme?.brand?.name ?? tenant.name}</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link to={`/t/${slug}/products`} className="sf-navlink">Productos</Link>
          </nav>
          <div className="flex items-center gap-2">
            {tenant.whatsappEnabled && tenant.whatsappPhone && (
              <a href={whatsappLink(tenant.whatsappPhone, `Hola, quiero información sobre ${tenant.name}.`)} target="_blank" rel="noopener noreferrer" className="sf-ghost flex items-center gap-1 text-sm">
                <MessageCircle className="size-4" /> <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            <Link to={`/t/${slug}/cart`} className="sf-cta flex items-center gap-1.5 text-sm">
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">Carrito</span>
              {cart && cart.itemCount > 0 && <span className="sf-cart-count">{cart.itemCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="sf-footer border-t mt-12">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <p>{theme?.footer?.text ?? `© ${new Date().getFullYear()} ${tenant.name}`}</p>
          <p className="sf-muted">{tenant.isDemo ? "Tienda demo — datos de prueba" : `Impulsado por Shoply`}</p>
        </div>
      </footer>
    </div>
  );
}
