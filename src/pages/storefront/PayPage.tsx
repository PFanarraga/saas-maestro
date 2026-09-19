import { useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils-shared";

export default function PayPage() {
  const { token } = useParams<{ token: string }>();
  const data = useQuery(api.payments.publicPayPage, token ? { token } : "skip");
  const simulate = useMutation(api.payments.simulatePayment);
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    if (!token) return;
    setPaying(true);
    try {
      await simulate({ token });
      toast.success("¡Pago confirmado! Gracias por tu compra.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo procesar el pago");
    } finally {
      setPaying(false);
    }
  };

  if (data === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <p className="font-semibold">Link de pago no válido o expirado</p>
          <p className="text-sm text-muted-foreground mt-1">Solicita un nuevo link a la tienda.</p>
        </div>
      </main>
    );
  }
  if (!data) return <div className="min-h-screen" />;

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
          <div className="bg-primary text-primary-foreground px-5 py-4">
            <p className="text-xs opacity-80">{data.storeName}</p>
            <p className="font-semibold">Pago del pedido #{data.orderNumber}</p>
          </div>
          <div className="p-5 space-y-4">
            {data.status === "paid" ? (
              <div className="text-center py-4">
                <CheckCircle2 className="mx-auto size-12 text-emerald-500 mb-2" />
                <p className="font-semibold">¡Pago completado!</p>
                <p className="text-sm text-muted-foreground">El pedido #{data.orderNumber} ya está pagado.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {data.items.map((i: any) => (
                    <div key={i._id ?? i.name} className="flex justify-between text-sm gap-2">
                      <span className="min-w-0 truncate">{i.name}{i.variantLabel ? ` (${i.variantLabel})` : ""} ×{i.quantity}</span>
                      <span className="shrink-0">{formatMoney(i.total, data.currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Total a pagar</span>
                  <span className="text-2xl font-bold">{formatMoney(data.amount, data.currency)}</span>
                </div>
                {data.provider === "culqi" ? (
                  <Button className="w-full" size="lg" asChild disabled>
                    <span><CreditCard className="size-4 mr-2" /> Pagar con Culqi (requiere CULQI_SECRET_KEY)</span>
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={handlePay} disabled={paying}>
                    {paying ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CreditCard className="size-4 mr-2" />}
                    Confirmar pago
                  </Button>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Pago procesado de forma segura. El estado de tu pedido se actualiza cuando la tienda confirma la transacción.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
