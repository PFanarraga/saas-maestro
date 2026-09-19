import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { formatMoney, whatsappLink } from "@/lib/utils-shared";

export default function OrderSuccess() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const number = searchParams.get("number") ?? "";
  const phone = searchParams.get("phone") ?? "";

  const order = useQuery(api.orders.lookupPublicOrder, slug && number && phone ? { slug, number, phone } : "skip");
  const tenant = useQuery(api.storefront.getTenantBySlug, slug ? { slug } : "skip");

  const waContact = tenant?.whatsappEnabled && tenant.whatsappPhone
    ? whatsappLink(tenant.whatsappPhone, `Hola, quiero consultar mi pedido #${number}.`)
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sf-fg">
      <div className="sf-card rounded-[var(--sf-radius)] border p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 sf-in mb-3" />
        <h1 className="text-xl font-bold">¡Pedido recibido!</h1>
        <p className="sf-muted text-sm mt-1">
          Tu pedido <span className="font-mono font-semibold sf-fg">#{number}</span> fue registrado.
        </p>

        {order && (
          <div className="mt-5 rounded-[calc(var(--sf-radius)-2px)] border p-4 text-left space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 sf-muted" />
              <span className="text-sm font-medium">Estado: {order.statusLabel}</span>
            </div>
            <div className="space-y-1.5">
              {order.items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{i.name}{i.variantLabel ? ` (${i.variantLabel})` : ""} ×{i.quantity}</span>
                  <span>{formatMoney(i.total, order.currency)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span className="sf-price">{formatMoney(order.total, order.currency)}</span>
            </div>
            {order.status === "payment_pending" && (
              <p className="sf-muted text-xs">
                {order.paymentUrl
                  ? "La tienda te enviará un link de pago por WhatsApp."
                  : "La tienda confirmará el pago y el estado se actualizará."}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {waContact && (
            <a href={waContact} target="_blank" rel="noopener noreferrer" className="sf-cta block px-6 py-3 text-sm font-semibold">
              <MessageCircle className="size-4 inline mr-1.5 -mt-0.5" /> Consultar por WhatsApp
            </a>
          )}
          <Link to={`/t/${slug}`} className="sf-ghost block border px-6 py-3 text-sm">Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}
