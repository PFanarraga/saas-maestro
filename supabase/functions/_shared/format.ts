// Port of src/lib/utils-shared.ts (server-side helpers used by the API).
export function formatMoney(amount: number, currency = "PEN"): string {
  const symbols: Record<string, string> = { PEN: "S/", USD: "$", EUR: "€", MXN: "$", CLP: "$", ARS: "$", COP: "$" };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export function whatsappLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildCartMessage(items: Array<{ name: string; quantity: number; variantLabel?: string }>, total: number, currency = "PEN"): string {
  const lines = items.map((i) => `- ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} x${i.quantity}`);
  return ["Hola, quiero comprar:", "", ...lines, "", `Total: ${formatMoney(total, currency)}`].join("\n");
}

export function buildPaymentMessage(orderNumber: string, total: number, paymentUrl: string, currency = "PEN"): string {
  return [
    `Hola, tu pedido #${orderNumber} está pendiente de pago.`,
    "",
    `Total: ${formatMoney(total, currency)}`,
    "",
    "Puedes realizar el pago aquí:",
    paymentUrl,
  ].join("\n");
}
