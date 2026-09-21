import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router";
import { useApi } from "@/hooks/use-api";
import { ShoppingBag, MessageCircle } from "lucide-react";
import { formatMoney, whatsappLink, type ThemeConfig } from "@/lib/utils-shared";
import { cn } from "@/lib/utils";

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
  const activeTemplateId = themeData?.tenant?.activeTemplateId ?? 'shoply-minimal';

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
    <div style={styleVars} className={cn("sf-scope min-h-screen flex flex-col", activeTemplateId)}>
      {theme?.header?.announcement && (
        <div className="sf-announcement px-4 py-2 text-center text-xs font-bold tracking-tight">{theme.header.announcement}</div>
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

      <style>{`
        /* Template Base Styles */
        .sf-scope { background-color: var(--sf-bg); color: var(--sf-fg); }
        .sf-announcement { background-color: var(--sf-primary); color: var(--sf-primary-fg); }
        .sf-header { background-color: var(--sf-bg); border-bottom: 1px solid var(--sf-border); }
        .sf-navlink { color: var(--sf-muted-fg); transition: color 0.2s; font-weight: 500; }
        .sf-navlink:hover { color: var(--sf-primary); }
        .sf-cta { background-color: var(--sf-primary); color: var(--sf-primary-fg); border-radius: var(--sf-radius); padding: 0.5rem 1rem; font-weight: 600; transition: opacity 0.2s; }
        .sf-cta:hover { opacity: 0.9; }
        .sf-ghost { color: var(--sf-muted-fg); transition: color 0.2s; font-weight: 500; }
        .sf-ghost:hover { color: var(--sf-primary); }
        .sf-cart-count { background-color: var(--sf-primary-fg); color: var(--sf-primary); font-size: 10px; font-weight: 800; border-radius: 99px; min-width: 18px; height: 18px; display: inline-flex; items-center; justify-content: center; }
        .sf-footer { background-color: var(--sf-muted); border-top: 1px solid var(--sf-border); color: var(--sf-muted-fg); }

        /* Template Specific: Fashion */
        .shoply-fashion .sf-header { border-bottom: 2px solid var(--sf-border); height: 80px; }
        .shoply-fashion .sf-logo-badge { border-radius: 0; }
        .shoply-fashion .sf-cta { border-radius: 0; text-transform: uppercase; letter-spacing: 0.1em; }

        /* Template Specific: Beauty */
        .shoply-beauty .sf-scope { background-image: radial-gradient(var(--sf-muted) 1px, transparent 1px); background-size: 40px 40px; }
        .shoply-beauty .sf-cta { border-radius: 99px; box-shadow: 0 4px 14px 0 var(--sf-muted); }

        /* Template Specific: Food */
        .shoply-food .sf-header { border-bottom-style: dashed; }
        .shoply-food .sf-cta { background: linear-gradient(to bottom right, var(--sf-primary), var(--sf-accent)); }

        /* Template Specific: Tech */
        .shoply-tech .sf-scope { background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 20px 20px; }
        .shoply-tech .sf-header { backdrop-filter: blur(10px); background-color: rgba(15, 23, 42, 0.8); }
        .shoply-tech .sf-cta { border: 1px solid var(--sf-accent); box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }

        /* Template Specific: Boutique */
        .shoply-boutique .sf-scope { padding: 1rem; }
        .shoply-boutique .sf-header { border: 1px solid var(--sf-border); border-radius: 1rem; margin-bottom: 1rem; }
        .shoply-boutique .sf-footer { border-radius: 1rem; }
      `}</style>
    </div>
  );
}
