/**
 * Fuente única de verdad de la frecuencia de pago en el frontend.
 *
 * Espeja el dominio del backend (creditCalculator.addFrequencyPeriods +
 * migración 045_payment_frequency_daily). Agregar una frecuencia nueva se hace
 * SOLO acá: el tipo, las etiquetas y las opciones de selector se derivan de este
 * módulo, evitando la duplicación que existía en ~10 componentes.
 */
export type PaymentFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** Etiqueta legible por frecuencia (chips, selectores, detalle del crédito). */
export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
};

/** Sufijo de unidad para montos por cuota (ej. "$1.000 /día"). */
export const FREQUENCY_UNIT_LABELS: Record<PaymentFrequency, string> = {
  DAILY: '/día',
  WEEKLY: '/semana',
  BIWEEKLY: '/quincena',
  MONTHLY: '/mes',
};

/** Etiqueta corta para tablas/listados compactos. */
export const FREQUENCY_SHORT_LABELS: Record<PaymentFrequency, string> = {
  DAILY: 'Diar.',
  WEEKLY: 'Sem.',
  BIWEEKLY: 'Quinc.',
  MONTHLY: 'Mens.',
};

/** Texto del corrimiento de la primera cuota (paso de condiciones). */
export const FREQUENCY_OFFSET_LABELS: Record<PaymentFrequency, string> = {
  DAILY: '+ 1 día',
  WEEKLY: '+ 7 días',
  BIWEEKLY: '+ 14 días',
  MONTHLY: '+ 1 mes',
};

/** Opciones para selectores (p-dropdown / p-select), de la más granular a la más espaciada. */
export const FREQUENCY_OPTIONS: { label: string; value: PaymentFrequency }[] = [
  { label: FREQUENCY_LABELS.DAILY, value: 'DAILY' },
  { label: FREQUENCY_LABELS.WEEKLY, value: 'WEEKLY' },
  { label: FREQUENCY_LABELS.BIWEEKLY, value: 'BIWEEKLY' },
  { label: FREQUENCY_LABELS.MONTHLY, value: 'MONTHLY' },
];
