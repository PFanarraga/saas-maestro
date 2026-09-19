import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SearchX } from "lucide-react";
import { ProductCard } from "./Home";

export default function StoreCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") ?? undefined;
  const search = searchParams.get("q") ?? undefined;

  const products = useQuery(api.storefront.listPublicProducts, slug ? { slug, categorySlug: category, search } : "skip");
  const categories = useQuery(api.catalog.listPublicCategories, slug ? { slug } : "skip");
  const tenant = useQuery(api.storefront.getTenantBySlug, slug ? { slug } : "skip");

  const roots = useMemo(() => (categories ?? []).filter((c: any) => !c.parentId), [categories]);
  const currency = tenant?.currency ?? "PEN";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sf-fg">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Productos</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSearchParams({})}
          className={`sf-chip rounded-full border px-3 py-1.5 text-xs ${!category ? "sf-chip-active" : ""}`}
        >
          Todos
        </button>
        {roots.map((c: any) => (
          <button
            key={c._id}
            onClick={() => setSearchParams({ category: c.slug })}
            className={`sf-chip rounded-full border px-3 py-1.5 text-xs ${category === c.slug ? "sf-chip-active" : ""}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {(products ?? []).length === 0 ? (
        <div className="py-16 text-center">
          <SearchX className="mx-auto size-8 sf-muted mb-2" />
          <p className="sf-muted text-sm">No hay productos en esta vista.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {(products ?? []).map((p: any) => <ProductCard key={p._id} product={p} slug={slug!} currency={currency} />)}
        </div>
      )}
    </div>
  );
}
