import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { MessageCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils-shared";
import { useStoreSession } from "./Storefront";

export default function StoreCart() {
  const { slug } = useParams<{ slug: string }>();
  const sessionKey = useStoreSession(slug);
  const cart = useQuery(api.cart.getCart, slug ? { slug, sessionKey } : "skip");
  const updateItem = useMutation(api.cart.updateCartItem);
  const removeItem = useMutation(api.cart.removeCartItem);

  const setQty = async (itemId: string, qty: number) => {
    try {
      await updateItem({ slug: slug!, sessionKey, itemId: itemId as any, quantity: qty });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  if (!cart) return <div className="min-h-[50vh]" />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sf-fg">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Tu carrito</h1>

      {cart.items.length === 0 ? (
        <div className="py-16 text-center">
          <ShoppingBag className="mx-auto size-10 sf-muted mb-3" />
          <p className="sf-muted mb-4">Tu carrito está vacío.</p>
          <Link to={`/t/${slug}/products`} className="sf-cta inline-block px-6 py-2.5 text-sm font-semibold">Ver productos</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cart.items.map((item: any) => (
              <div key={item._id} className="sf-card flex items-center gap-3 rounded-[var(--sf-radius)] border p-3">
                <div className="sf-img size-16 rounded-[calc(var(--sf-radius)-4px)] overflow-hidden shrink-0 flex items-center justify-center text-2xl opacity-40">🛍️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{item.name}</p>
                  {item.variantLabel && <p className="sf-muted text-xs">{item.variantLabel}</p>}
                  <p className="sf-price text-sm font-semibold">{formatMoney(item.unitPrice, cart.currency)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button className="sf-iconbtn size-7 flex items-center justify-center border" onClick={() => setQty(item._id, item.quantity - 1)} aria-label="Quitar uno"><Minus className="size-3" /></button>
                  <span className="w-7 text-center text-sm">{item.quantity}</span>
                  <button className="sf-iconbtn size-7 flex items-center justify-center border" onClick={() => setQty(item._id, item.quantity + 1)} aria-label="Agregar uno"><Plus className="size-3" /></button>
                </div>
                <button className="sf-muted p-1.5" onClick={() => removeItem({ slug: slug!, sessionKey, itemId: item._id }).then(() => toast.success("Eliminado"))} aria-label="Eliminar">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="sf-card mt-6 rounded-[var(--sf-radius)] border p-4">
            <div className="flex justify-between items-baseline">
              <span className="text-sm sf-muted">Subtotal ({cart.itemCount} items)</span>
              <span className="text-xl font-bold sf-price">{formatMoney(cart.subtotal, cart.currency)}</span>
            </div>
            <p className="sf-muted text-xs mt-1">El envío y los descuentos se calculan en el checkout.</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Link to={`/t/${slug}/checkout`} className="sf-cta flex-1 text-center px-6 py-3 text-sm font-semibold">Finalizar compra</Link>
              {cart.whatsappUrl && (
                <a href={cart.whatsappUrl} target="_blank" rel="noopener noreferrer" className="sf-ghost flex-1 text-center border px-6 py-3 text-sm">
                  <MessageCircle className="size-4 inline mr-1.5 -mt-0.5" /> Comprar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
