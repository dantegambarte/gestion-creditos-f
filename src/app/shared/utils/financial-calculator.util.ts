import {
  InterestRate,
  PaymentFrequency,
} from '../../features/admin/config/models/interfaces/interest-rate.model';
import { ProductRate } from '../../features/admin/config/models/interfaces/product';

/**
 * Calcula el valor de cuota redondeado al millar superior.
 * Fórmula exacta usada por el backend.
 * @param {number} capital - Capital financiado.
 * @param {number} rate - Tasa de interés (ej: 0.15 para 15%).
 * @param {number} installments - Cantidad de cuotas.
 * @returns {number} Valor de cuota redondeado al millar.
 */
export function calculateInstallmentValue(
  capital: number,
  rate: number,
  installments: number,
): number {
  if (installments <= 0) return 0;
  return Math.ceil((capital * (1 + rate)) / installments / 1000) * 1000;
}

/**
 * Calcula el total a devolver en el plan de pagos.
 * @param {number} installmentValue - Valor de una cuota.
 * @param {number} installments - Cantidad de cuotas.
 * @returns {number} Total del plan.
 */
export function calculateTotalToPay(installmentValue: number, installments: number): number {
  return installmentValue * installments;
}

/**
 * Calcula el capital a financiar descontando el anticipo, con piso en cero.
 * @param {number} baseCapital - Capital bruto (carrito o préstamo).
 * @param {number} downPayment - Anticipo a descontar.
 * @returns {number} Capital neto a financiar.
 */
export function calculateFinancedCapital(baseCapital: number, downPayment: number): number {
  return Math.max(0, baseCapital - downPayment);
}

/**
 * Busca la tasa de préstamo que corresponde al monto, las cuotas y la frecuencia
 * elegidas. La frecuencia es clave: el backend tiene tasas distintas por
 * frecuencia para la misma cantidad de cuotas y monto, así que sin filtrarla la
 * estimación local podía tomar la tasa de otra frecuencia (ej. semanal en vez de
 * mensual) y mostrar montos que no coincidían con la simulación real.
 * @param {InterestRate[]} rates - Tasas de préstamo disponibles.
 * @param {number} installments - Cuotas seleccionadas.
 * @param {number} amount - Monto del préstamo.
 * @param {PaymentFrequency} [frequency] - Frecuencia seleccionada. Si se omite, no filtra por frecuencia (compatibilidad).
 * @returns {number} Tasa encontrada, o 0 si no hay coincidencia.
 */
export function findLoanInterestRate(
  rates: InterestRate[],
  installments: number,
  amount: number,
  frequency?: PaymentFrequency,
): number {
  const match = rates.find(
    (r) =>
      r.installmentsCount === installments &&
      (frequency == null || r.paymentFrequency === frequency) &&
      amount >= r.minAmount &&
      (r.maxAmount == null || amount <= r.maxAmount),
  );
  return match?.rate ?? 0;
}

/**
 * Busca la tasa de producto para una combinación de cuotas y frecuencia.
 * @param {ProductRate[]} rates - Tasas del producto.
 * @param {number} installments - Cuotas seleccionadas para esa línea.
 * @param {string} frequency - Frecuencia de pago activa en el formulario.
 * @returns {ProductRate | undefined} Tasa coincidente, o undefined si no existe.
 */
export function findProductRate(
  rates: ProductRate[],
  installments: number,
  frequency: string,
): ProductRate | undefined {
  return rates.find(
    (r) => r.installmentsCount === installments && r.paymentFrequency === frequency,
  );
}

/**
 * Convierte una tasa decimal a porcentaje con dos decimales.
 * @param {number} rate - Tasa en formato decimal (ej: 0.15).
 * @returns {number} Porcentaje (ej: 15.00).
 */
export function rateToPercent(rate: number): number {
  return Math.round(rate * 10000) / 100;
}
