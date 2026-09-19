import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { formatMoney } from "@/lib/utils-shared";
import { useStoreSession } from "./Storefront";
import { Id } from "@/convex/_generated/dataModel";

export default function StoreCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const sessionKey = useStoreSession(slug);
  const navigate = useNavigate();

  const cart = useQuery(api.cart.getCart, slug ? { slug, sessionKey } : "skip");
  const tenant = useQuery(api.storefront.getTenantBySlug, slug ? { slug } : "skip");
  const rates = useQuery(api.store.listPublicDeliveryRates, slug ? { slug } : "skip");
  const checkout = useMutation(api.orders.checkout);

  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "", reference: "", notes: "" });
  const [rateId, setRateId] = useState<string>("");
  const [coupon, setCoupon] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (rates && rates.length > 0 && !rateId) {
      const pickup = rates.find((r: any) => r.method === "pickup");
      setRateId((pickup ?? rates[0])._id);
    }
  }, [rates, rateId]);

  if (!cart) return <div className="min-h-[50vh]" />;
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sf-fg">
        <p className="sf-muted">Tu carrito está vacío.</p>
      </div>
    );
  }

  const selectedRate = (rates ?? []).find((r: any) => r._id === rateId);
  const needsAddress = selectedRate && selectedRate.method !== "pickup";
  // Client-side preview of totals; final values are computed server-side.
  const discountPreview = 0;
  const deliveryPreview = selectedRate ? (selectedRate.freeOver && cart.subtotal >= selectedRate.freeOver ? 0 : selectedRate.price) : 0;
  const totalPreview = cart.subtotal - discountPreview + deliveryPreview;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nombre y teléfono son obligatorios");
      return;
    }
    if (needsAddress && !form.address.trim()) {
      toast.error("La dirección es obligatoria para el delivery");
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = `${sessionKey}-${Date.now()}`;
      const res = await checkout({
        slug: slug!,
        sessionKey,
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email || undefined,
        deliveryRateId: rateId ? (rateId as Id<"deliveryRates">) : undefined,
        addressLine1: form.address || undefined,
        addressCity: form.city || undefined,
        addressReference: form.reference || undefined,
        notes: form.notes || undefined,
        couponCode: coupon || undefined,
        idempotencyKey,
      });
      toast.success(`¡Pedido #${res.orderNumber} creado!`);
      navigate(`/t/${slug}/order-success?number=${res.orderNumber}&phone=${encodeURIComponent(form.phone)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const input = "sf-input w-full rounded-[var(--sf-radius)] border px-3 py-2.5 text-sm";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sf-fg">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Finalizar compra</h1>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="sf-card rounded-[var(--sf-radius)] border p-4 space-y-3">
            <p className="font-semibold text-sm">1. Tus datos</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input className={input} placeholder="Nombre completo *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className={input} placeholder="Teléfono / WhatsApp *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <input className={input} type="email" placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="sf-card rounded-[var(--sf-radius)] border p-4 space-y-3">
            <p className="font-semibold text-sm">2. Entrega</p>
            {(rates ?? []).length === 0 && <p className="sf-muted text-sm">Esta tienda no tiene métodos de entrega configurados.</p>}
            <div className="space-y-2">
              {(rates ?? []).map((r: any) => (
                <label key={r._id} className={`flex items-center justify-between rounded-[var(--sf-radius)] border p-3 cursor-pointer ${rateId === r._id ? "sf-rate-active" : ""}`}>
                  <div className="flex items-center gap-2.5">
                    <input type="radio" name="rate" checked={rateId === r._id} onChange={() => setRateId(r._id)} className="accent-[var(--sf-primary)]" />
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="sf-muted text-xs">{r.zoneName}{r.eta ? ` · ${r.eta}` : ""}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{r.price === 0 ? "Gratis" : formatMoney(r.price, tenant?.currency)}</span>
                </label>
              ))}
            </div>
            {needsAddress && (
              <div className="space-y-2 pt-1">
                <input className={input} placeholder="Dirección *" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className={input} placeholder="Distrito / Ciudad" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  <input className={input} placeholder="Referencia" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {tenant?.couponsEnabled && (
            <div className="sf-card rounded-[var(--sf-radius)] border p-4 space-y-2">
              <p className="font-semibold text-sm">3. Cupón de descuento</p>
              <input className={input} placeholder="Código (ej. BIENVENIDO10)" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
              <p className="sf-muted text-xs">El descuento se valida y aplica al confirmar el pedido.</p>
            </div>
          )}

          <div className="sf-card rounded-[var(--sf-radius)] border p-4 space-y-2">
            <p className="font-semibold text-sm">4. Notas para la tienda</p>
            <textarea className={input} rows={2} placeholder="Indicaciones adicionales (opcional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="sf-card self-start rounded-[var(--sf-radius)] border p-4 space-y-3 lg:sticky lg:top-20">
          <p className="font-semibold text-sm">Resumen del pedido</p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {cart.items.map((i: any) => (
              <div key={i._id} className="flex justify-between text-sm gap-2">
                <span className="min-w-0 truncate">{i.name}{i.variantLabel ? ` (${i.variantLabel})` : ""} ×{i.quantity}</span>
                <span className="shrink-0">{formatMoney(i.unitPrice * i.quantity, cart.currency)}</span>
              </div>
            ))}
          </div>
          <div className="sf-muted border-t pt-2 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(cart.subtotal, cart.currency)}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span>{deliveryPreview === 0 ? "Gratis" : formatMoney(deliveryPreview, cart.currency)}</span></div>
            {coupon && <div className="flex justify-between"><span>Cupón {coupon}</span><span>se aplica al confirmar</span></div>}
          </div>
          <div className="border-t pt-2 flex justify-between items-baseline">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold sf-price">{formatMoney(totalPreview, cart.currency)}</span>
          </div>
          <button type="submit" disabled={submitting} className="sf-cta w-full px-6 py-3 text-sm font-semibold disabled:opacity-50">
            {submitting ? <Loader2 className="size-4 inline mr-1.5 animate-spin" /> : <Lock className="size-4 inline mr-1.5 -mt-0.5" />}
            Confirmar pedido
          </button>
          <p className="sf-muted text-xs text-center">Checkout como invitado. Sin registro.</p>
        </div>
      </form>
    </div>
  );
}
