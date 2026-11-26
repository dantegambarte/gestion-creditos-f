import { CollectionSheetItem } from './collection.model';

// El cobro es una operación VIVA: se usa el saldo actual de la cuota (con mora).
// En planillas read-only (live=null) se cae al snapshot, campo por campo.

/**
 * Monto vivo de la cuota (con mora), con el snapshot como fallback histórico.
 * @param item - cuota de la planilla
 */
export function itemAmountDue(item: CollectionSheetItem): number {
  return item.live?.amountDue ?? item.amountDue;
}

/**
 * Mora viva acumulada, con el snapshot como fallback histórico.
 * @param item - cuota de la planilla
 */
export function itemPenalty(item: CollectionSheetItem): number {
  return item.live?.penaltyAmount ?? item.penaltyAmount;
}

/**
 * Monto ya pagado vivo, con el snapshot como fallback histórico.
 * @param item - cuota de la planilla
 */
export function itemAmountPaid(item: CollectionSheetItem): number {
  return item.live?.amountPaid ?? item.amountPaid;
}

/**
 * Capital de la cuota sin mora (monto vivo menos mora viva), nunca negativo.
 * @param item - cuota de la planilla
 */
export function itemCapital(item: CollectionSheetItem): number {
  return Math.max(0, itemAmountDue(item) - itemPenalty(item));
}

/**
 * Saldo disponible a cobrar (monto vivo menos lo ya pagado), nunca negativo.
 * @param item - cuota de la planilla
 */
export function itemAvailableBalance(item: CollectionSheetItem): number {
  return Math.max(0, itemAmountDue(item) - itemAmountPaid(item));
}
