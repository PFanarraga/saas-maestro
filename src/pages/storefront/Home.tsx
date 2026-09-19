import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatMoney, type PageBlock } from "@/lib/utils-shared";

export function ProductCard({ product, slug, currency }: { product: any; slug: string; currency: string }) {
  return (
    <Link to={`/t/${slug}/product/${product.slug}`} className="sf-card sf-hover group rounded-[var(--sf-radius)] border overflow-hidden">
      <div className="sf-img aspect-square overflow-hidden">
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="size-full flex items-center justify-center text-3xl opacity-30">🛍️</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium leading-snug line-clamp-2">{product.name}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <p className="sf-price text-sm font-bold">{formatMoney(product.price, currency)}</p>
          {product.comparePrice && <p className="sf-muted text-xs line-through">{formatMoney(product.comparePrice, currency)}</p>}
        </div>
      </div>
    </Link>
  );
}

export default function StoreHome() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "draft";
  const page = useQuery(
    isPreview ? api.store.getPageDraft : api.store.getPublishedPage,
    isPreview ? { slug: "home" } : slug ? { slug: "home", tenantSlug: slug } : "skip",
  );
  const featured = useQuery(api.storefront.listPublicProducts, slug ? { slug } : "skip");
  const categories = useQuery(api.catalog.listPublicCategories, slug ? { slug } : "skip");
  const tenant = useQuery(api.storefront.getTenantBySlug, slug ? { slug } : "skip");

  if (!page) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sf-fg">
        <p className="text-lg font-semibold">Tienda en preparación</p>
        <p className="sf-muted text-sm">El propietario aún no publica contenido.</p>
      </div>
    );
  }

  const blocks = (page.blocks as PageBlock[]).filter((b) => !b.hidden).sort((a, b) => a.position - b.position);
  const currency = tenant?.currency ?? "PEN";

  const renderBlock = (b: PageBlock) => {
    switch (b.type) {
      case "hero":
        return (
          <section key={b.id} className="sf-hero py-16 px-4 text-center" style={{ textAlign: b.settings.align ?? "center" }}>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3" style={{ fontFamily: "var(--sf-heading, inherit)" }}>{b.settings.title}</h1>
            <p className="sf-muted text-base sm:text-lg max-w-xl mx-auto mb-6">{b.settings.subtitle}</p>
            {b.settings.ctaLabel && (
              <Link to={`/t/${slug}/products`} className="sf-cta inline-block px-6 py-3 text-sm font-semibold">{b.settings.ctaLabel}</Link>
            )}
          </section>
        );
      case "banner":
        return (
          <section key={b.id} className="mx-auto max-w-6xl px-4 py-6">
            <div className="sf-banner rounded-[var(--sf-radius)] p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xl font-bold">{b.settings.title}</p>
                <p className="sf-muted text-sm">{b.settings.subtitle}</p>
              </div>
              {b.settings.ctaLabel && <Link to={b.settings.ctaHref || "/products"} className="sf-cta px-4 py-2 text-sm font-semibold">{b.settings.ctaLabel}</Link>}
            </div>
          </section>
        );
      case "categories":
        return (
          <section key={b.id} className="mx-auto max-w-6xl px-4 py-8">
            <h2 className="text-xl font-bold mb-4">{b.settings.title ?? "Categorías"}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(categories ?? []).filter((c: any) => !c.parentId).slice(0, 8).map((c: any) => (
                <Link key={c._id} to={`/t/${slug}/products?category=${c.slug}`} className="sf-card rounded-[var(--sf-radius)] border p-4 text-center sf-hover">
                  <p className="font-medium text-sm">{c.name}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      case "featured_products":
      case "new_products": {
        const items = (featured ?? []).filter((p: any) => (b.type === "featured_products" ? p.featured : true)).slice(0, b.settings.limit ?? 8);
        return (
          <section key={b.id} className="mx-auto max-w-6xl px-4 py-8">
            <h2 className="text-xl font-bold mb-4">{b.settings.title ?? "Productos"}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {items.map((p: any) => <ProductCard key={p._id} product={p} slug={slug!} currency={currency} />)}
            </div>
          </section>
        );
      }
      case "text":
        return (
          <section key={b.id} className="mx-auto max-w-6xl px-4 py-8">
            <h2 className="text-xl font-bold mb-2">{b.settings.title}</h2>
            <p className="sf-muted whitespace-pre-line">{b.settings.body}</p>
          </section>
        );
      case "image":
        return (
          <section key={b.id} className="mx-auto max-w-6xl px-4 py-8">
            {b.settings.imageUrl && <img src={b.settings.imageUrl} alt={b.settings.caption ?? ""} className="w-full rounded-[var(--sf-radius)]" />}
            {b.settings.caption && <p className="sf-muted text-xs text-center mt-2">{b.settings.caption}</p>}
          </section>
        );
      case "video":
        return (
          <section key={b.id} className="mx-auto max-w-3xl px-4 py-8">
            {b.settings.videoUrl && <iframe src={b.settings.videoUrl} title={b.settings.title ?? "video"} className="w-full aspect-video rounded-[var(--sf-radius)]" allowFullScreen />}
          </section>
        );
      case "testimonials":
        return (
          <section key={b.id} className="mx-auto max-w-6xl px-4 py-8">
            <h2 className="text-xl font-bold mb-4">{b.settings.title}</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              {(b.settings.items ?? []).map((t: any, i: number) => (
                <div key={i} className="sf-card rounded-[var(--sf-radius)] border p-4">
                  <p className="text-sm">"{t.text}"</p>
                  <p className="sf-muted text-xs mt-2">— {t.name}</p>
                </div>
              ))}
            </div>
          </section>
        );
      case "faq":
        return (
          <section key={b.id} className="mx-auto max-w-2xl px-4 py-8">
            <h2 className="text-xl font-bold mb-4">{b.settings.title}</h2>
            <div className="space-y-2">
              {(b.settings.items ?? []).map((f: any, i: number) => (
                <details key={i} className="sf-card rounded-[var(--sf-radius)] border p-3">
                  <summary className="text-sm font-medium cursor-pointer">{f.q}</summary>
                  <p className="sf-muted text-sm mt-1">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        );
      case "newsletter":
        return (
          <section key={b.id} className="mx-auto max-w-2xl px-4 py-8 text-center">
            <div className="sf-card rounded-[var(--sf-radius)] border p-6">
              <h2 className="text-lg font-bold">{b.settings.title}</h2>
              <p className="sf-muted text-sm mb-3">{b.settings.subtitle}</p>
              <div className="flex gap-2 max-w-sm mx-auto">
                <input className="sf-input flex-1 rounded-[var(--sf-radius)] border px-3 py-2 text-sm" placeholder="tu@email.com" />
                <button className="sf-cta px-4 py-2 text-sm font-semibold">Suscribirme</button>
              </div>
            </div>
          </section>
        );
      case "spacer":
        return <div key={b.id} style={{ height: b.settings.height ?? 40 }} />;
      default:
        return null;
    }
  };

  return (
    <div className="sf-fg">
      {isPreview && (
        <div className="sf-announcement px-4 py-1.5 text-center text-[11px]">Vista previa del borrador — no publicado</div>
      )}
      {blocks.map(renderBlock)}
    </div>
  );
}
