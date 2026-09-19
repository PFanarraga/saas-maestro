import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useApi } from "@/hooks/use-api";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, ShoppingBag } from "lucide-react";
import { buildProductInquiryMessage, formatMoney, whatsappLink } from "@/lib/utils-shared";
import { useStoreSession } from "./Storefront";

export default function StoreProduct() {
  const { slug, productSlug } = useParams<{ slug: string; productSlug: string }>();
  const { request } = useApi();
  const navigate = useNavigate();
  const sessionKey = useStoreSession(slug);

  const [product, setProduct] = useState<any>(undefined);
  const [tenant, setTenant] = useState<any>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!slug || !productSlug) return;
    request<any>(`/public/tenants/${slug}/products/${productSlug}`).then(({ data }) => setProduct(data));
    request<any>(`/public/tenants/${slug}`).then(({ data }) => setTenant(data));
  }, [slug, productSlug, request]);

  useEffect(() => {
    if (slug && product?.id) {
      request(`/public/tenants/${slug}/events`, {
        method: "POST",
        body: JSON.stringify({ type: "product_view", productId: product.id, sessionId: sessionKey })
      }).catch(() => undefined);
    }
  }, [slug, product?.id, sessionKey, request]);

  const currency = tenant?.currency ?? "PEN";

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    return product.variants.find((v: any) => v.options.every((o: any) => selection[o.name] === o.value)) ?? null;
  }, [product, selection]);

  const price = selectedVariant?.price ?? product?.price ?? 0;
  const stock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0;

  const handleAdd = async (goToCart: boolean) => {
    if (!product) return;
    if (product.variants?.length && !selectedVariant) {
      toast.error("Selecciona todas las opciones");
      return;
    }
    setAdding(true);
    try {
      const { error } = await request("/cart/items", {
        method: "POST",
        body: JSON.stringify({ slug: slug!, sessionKey, productId: product.id, variantId: selectedVariant?.id, quantity: 1 })
      });
      if (error) throw new Error(error);

      await request(`/public/tenants/${slug}/events`, {
        method: "POST",
        body: JSON.stringify({ type: "add_to_cart", productId: product.id, value: price, sessionId: sessionKey })
      }).catch(() => undefined);

      toast.success("Agregado al carrito");
      if (goToCart) navigate(`/t/${slug}/cart`);
    } catch (e: any) {
      toast.error(e.message || "No se pudo agregar");
    } finally {
      setAdding(false);
    }
  };

  if (product === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sf-fg">
        <p className="text-lg font-semibold">Producto no encontrado</p>
        <Link to={`/t/${slug}/products`} className="sf-link text-sm mt-2 inline-block">Volver al catálogo</Link>
      </div>
    );
  }
  if (!product) return <div className="min-h-[50vh]" />;

  const waInquiry = tenant?.whatsappEnabled && tenant.whatsappPhone
    ? whatsappLink(tenant.whatsappPhone, buildProductInquiryMessage(product.name, product.sku, price, currency))
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sf-fg">
      <Link to={`/t/${slug}/products`} className="sf-muted inline-flex items-center gap-1 text-sm mb-4 sf-link">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="sf-card rounded-[var(--sf-radius)] border overflow-hidden">
            <div className="aspect-square">
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name} className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-6xl opacity-30">🛍️</div>
              )}
            </div>
          </div>
        </div>
        <div>
          {product.categoryName && <p className="sf-muted text-xs uppercase tracking-wide mb-1">{product.categoryName}</p>}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.name}</h1>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="sf-price text-2xl font-bold">{formatMoney(price, currency)}</p>
            {product.comparePrice && <p className="sf-muted line-through">{formatMoney(product.comparePrice, currency)}</p>}
          </div>
          {product.shortDescription && <p className="sf-muted mt-2 text-sm">{product.shortDescription}</p>}

          {(product.options ?? []).map((opt: any) => (
            <div key={opt.name} className="mt-4">
              <p className="text-sm font-medium mb-1.5">{opt.name}</p>
              <div className="flex flex-wrap gap-2">
                {opt.values.map((val: string) => {
                  const active = selection[opt.name] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setSelection((s) => ({ ...s, [opt.name]: val }))}
                      className={`sf-chip rounded-full border px-3 py-1.5 text-xs ${active ? "sf-chip-active" : ""}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-5 space-y-3">
            <p className={`text-sm ${stock === 0 ? "sf-out" : "sf-in"}`}>
              {stock === 0 ? "Agotado" : stock <= 5 ? `¡Últimas ${stock} unidades!` : "En stock"}
            </p>
            <button disabled={stock === 0 || adding} onClick={() => handleAdd(true)} className="sf-cta w-full sm:w-auto px-6 py-3 text-sm font-semibold disabled:opacity-50">
              <ShoppingBag className="size-4 inline mr-1.5 -mt-0.5" /> Agregar al carrito
            </button>
            {waInquiry && (
              <a href={waInquiry} target="_blank" rel="noopener noreferrer" className="sf-ghost block w-full sm:w-auto text-center px-6 py-3 text-sm border">
                <MessageCircle className="size-4 inline mr-1.5 -mt-0.5" /> Consultar por WhatsApp
              </a>
            )}
          </div>

          {product.description && (
            <div className="mt-6 border-t pt-4">
              <p className="sf-muted whitespace-pre-line text-sm">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
