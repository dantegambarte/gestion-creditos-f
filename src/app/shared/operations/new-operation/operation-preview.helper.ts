import type { SimulateResult } from '../../../features/seller/models/credit.model';
import { PaymentFrequency } from '../../models/payment-frequency';
import { calculateInstallmentValue } from '../../utils/financial-calculator.util';
import type { CartLine } from './operation-form.service';

/**
 * Helper único de vista previa del wizard de nueva operación. Lo usan los pasos
 * de condiciones y de confirmación para que cuota, cantidad, total y cronograma
 * salgan de las mismas fórmulas que la simulación y el alta del backend.
 */

/** Fila del cronograma de vista previa. */
export interface SchedulePreviewRow {
  installmentNumber: number;
  dueDate: Date;
  amount: number;
  isAdvanced: boolean;
}

/** Datos necesarios para construir el cronograma de vista previa. */
export interface SchedulePreviewInput {
  simulation: SimulateResult | null;
  firstPaymentDate: Date | null;
  frequency: PaymentFrequency | string | null;
  installmentsCount: number;
  installmentValue: number;
  advancedCount: number;
  isAdvanceMode: boolean;
  approvalDate: Date;
  limit: number;
}

/**
 * Suma el total del carrito (precio por cantidad), igual que el total que se envía.
 * @param {CartLine[]} lines - líneas del carrito
 * @returns {number} total bruto del carrito
 */
export function getCartTotal(lines: CartLine[]): number {
  return lines.reduce((acc, line) => acc + line.precio * line.cantidad, 0);
}

/**
 * Valor de cuota de una línea con la fórmula del backend: capital de la línea
 * menos su parte prorrateada del anticipo, más la tasa elegida, redondeado al millar.
 * @param {CartLine} line - línea del carrito
 * @param {string | null} frequency - frecuencia de pago elegida
 * @param {number} downPayment - anticipo total validado
 * @param {number} cartTotal - total del carrito para prorratear el anticipo
 * @returns {number} valor de cuota de la línea
 */
export function getLineInstallmentValue(
  line: CartLine,
  frequency: PaymentFrequency | string | null,
  downPayment: number,
  cartTotal: number,
): number {
  const installments = Number(line.selectedInstallments ?? 0);
  if (installments <= 0) return 0;
  const rate =
    line.rates.find((r) => r.installmentsCount === installments && r.paymentFrequency === frequency)
      ?.rate ?? 0;
  const lineDownPayment =
    downPayment > 0 && cartTotal > 0 ? (line.subtotal / cartTotal) * downPayment : 0;
  const financed = Math.max(0, line.subtotal - lineDownPayment);
  return calculateInstallmentValue(financed, rate, installments);
}

/**
 * Cantidad de cuotas del plan: la de la simulación si existe; si no, en ventas
 * la mayor cantidad del carrito (igual que el payload de simulación) y en
 * préstamos la elegida en el formulario.
 * @returns {number} cantidad de cuotas del plan
 */
export function getPlanInstallmentsCount(
  type: 'SALE' | 'LOAN' | string | null,
  lines: CartLine[],
  loanInstallments: number | null,
  simulation: SimulateResult | null,
): number {
  if (simulation?.installmentsCount) return simulation.installmentsCount;
  if (type === 'SALE') {
    return Math.max(0, ...lines.map((line) => Number(line.selectedInstallments ?? 0)));
  }
  return Number(loanInstallments ?? 0);
}

/**
 * Avanza una fecha la cantidad de períodos indicada según la frecuencia
 * (DAILY, WEEKLY, BIWEEKLY o MONTHLY por mes calendario, como el backend).
 * @param {Date} baseDate - fecha de arranque
 * @param {string | null} frequency - frecuencia del plan
 * @param {number} periods - cantidad de períodos a avanzar
 * @returns {Date} nueva fecha
 */
export function addFrequencyPeriods(
  baseDate: Date,
  frequency: PaymentFrequency | string | null,
  periods: number,
): Date {
  const date = new Date(baseDate);
  if (frequency === 'DAILY') {
    date.setDate(date.getDate() + periods);
  } else if (frequency === 'WEEKLY') {
    date.setDate(date.getDate() + periods * 7);
  } else if (frequency === 'BIWEEKLY') {
    date.setDate(date.getDate() + periods * 14);
  } else {
    date.setMonth(date.getMonth() + periods);
  }
  return date;
}

/**
 * Traduce el código de medio de pago a la etiqueta visible.
 * @param {string | null | undefined} value - CASH, TRANSFER o MIXED
 * @returns {string} etiqueta comercial
 */
export function paymentMethodLabel(value: string | null | undefined): string {
  if (value === 'TRANSFER') return 'Transferencia';
  if (value === 'MIXED') return 'Efectivo + Transferencia';
  return 'Efectivo';
}

/**
 * Parsea 'YYYY-MM-DD' como fecha local, sin el corrimiento UTC de new Date(string).
 * @param {string} value - fecha del backend
 * @returns {Date} fecha local
 */
export function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(value);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Construye el cronograma de vista previa tal como lo registra el backend al
 * aprobar: usa las fechas y montos de la simulación (o el cálculo local si no
 * hay). Solo en modo cuotas adelantadas, las adelantadas vencen en la fecha de
 * aprobación y las restantes ocupan los vencimientos liberados desde la cuota 1.
 * @param {SchedulePreviewInput} input - datos del plan
 * @returns {SchedulePreviewRow[]} primeras filas del cronograma
 */
export function buildSchedulePreview(input: SchedulePreviewInput): SchedulePreviewRow[] {
  const adv = input.isAdvanceMode ? Math.max(0, Number(input.advancedCount ?? 0)) : 0;

  const backendSchedule = input.simulation?.schedule ?? [];
  let base: { installmentNumber: number; dueDate: Date; amount: number }[];
  if (backendSchedule.length > 0) {
    base = backendSchedule.map((row) => ({
      installmentNumber: row.installmentNumber,
      dueDate: parseLocalDate(row.dueDate),
      amount: row.amount,
    }));
  } else {
    if (!input.firstPaymentDate || input.installmentsCount <= 0 || input.installmentValue <= 0) {
      return [];
    }
    const firstPaymentDate = input.firstPaymentDate;
    base = Array.from({ length: input.installmentsCount }).map((_, index) => ({
      installmentNumber: index + 1,
      dueDate: addFrequencyPeriods(firstPaymentDate, input.frequency, index),
      amount: input.installmentValue,
    }));
  }

  return base.slice(0, input.limit).map((row, index) => {
    const isAdvanced = row.installmentNumber <= adv;
    const dueDate = isAdvanced
      ? new Date(input.approvalDate)
      : (base[index - adv]?.dueDate ?? row.dueDate);
    return {
      installmentNumber: row.installmentNumber,
      dueDate,
      amount: row.amount,
      isAdvanced,
    };
  });
}
