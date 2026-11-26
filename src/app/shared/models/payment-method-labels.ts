/** Etiqueta visible por método de pago de un cobro — única fuente para listados y reportes. */
export const PAYMENT_METHOD_LABELS = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
} as const satisfies Record<'CASH' | 'TRANSFER' | 'MIXED', string>;

/**
 * Traduce un método de pago a su etiqueta visible usando `PAYMENT_METHOD_LABELS`.
 * Un valor vacío o desconocido devuelve `fallback`, nunca otra etiqueta por descarte.
 * @param {string | null | undefined} method - código persistido (CASH, TRANSFER, MIXED)
 * @param {string} fallback - texto cuando no hay método o no se reconoce
 * @returns {string} etiqueta legible
 */
export function paymentMethodLabel(method: string | null | undefined, fallback = '—'): string {
  if (method && Object.prototype.hasOwnProperty.call(PAYMENT_METHOD_LABELS, method)) {
    return PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS];
  }
  return fallback;
}

/**
 * Reparte un monto entre efectivo y transferencia según el método elegido.
 * Única regla de split de ingresos: CASH y TRANSFER llevan todo a un lado; MIXED usa los parciales.
 * @param {'CASH' | 'TRANSFER' | 'MIXED'} method - método elegido en el formulario
 * @param {number} amount - monto total
 * @param {number} amountCash - parcial en efectivo (sólo MIXED)
 * @param {number} amountTransfer - parcial por transferencia (sólo MIXED)
 * @returns {{ amountCash: number; amountTransfer: number }} split a enviar al backend
 */
export function splitAmountByMethod(
  method: 'CASH' | 'TRANSFER' | 'MIXED',
  amount: number,
  amountCash = 0,
  amountTransfer = 0,
): { amountCash: number; amountTransfer: number } {
  if (method === 'CASH') return { amountCash: amount, amountTransfer: 0 };
  if (method === 'TRANSFER') return { amountCash: 0, amountTransfer: amount };
  return { amountCash, amountTransfer };
}
