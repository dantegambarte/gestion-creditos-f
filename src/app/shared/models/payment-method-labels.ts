/** Etiqueta visible por método de pago de un cobro — única fuente para listados y reportes. */
export const PAYMENT_METHOD_LABELS = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
} as const satisfies Record<'CASH' | 'TRANSFER' | 'MIXED', string>;
