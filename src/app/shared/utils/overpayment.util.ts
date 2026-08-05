/**
 * Reglas de negocio del cobro con excedente. Funciones PURAS: no dependen de
 * Angular ni de ningún formulario, solo operan sobre montos. El cobrador (o el
 * admin) puede ingresar un monto mayor al de la cuota; el excedente se reparte a
 * las cuotas siguientes del crédito, topeado al saldo pendiente del crédito.
 *
 * Reutilizadas por el diálogo de cobro del cobrador y por el de cobro directo del
 * admin, que tienen UIs distintas pero las mismas reglas de monto.
 */

/**
 * El monto ingresado supera el saldo pendiente del crédito (tope máximo cobrable).
 * @param amount Monto total ingresado.
 * @param creditBalance Saldo pendiente del crédito.
 */
export function exceedsCreditBalance(
  amount: number,
  creditBalance: number,
): boolean {
  return amount > creditBalance;
}

/**
 * El monto supera la cuota actual pero es VÁLIDO (no excede el saldo del crédito):
 * el excedente se repartirá a las cuotas siguientes. En la última cuota, donde el
 * saldo del crédito es igual al de la cuota, nunca da true (no hay cuota siguiente).
 * @param amount Monto total ingresado.
 * @param installmentBalance Saldo pendiente de la cuota actual.
 * @param creditBalance Saldo pendiente del crédito.
 */
export function advancesNextInstallments(
  amount: number,
  installmentBalance: number,
  creditBalance: number,
): boolean {
  return amount > installmentBalance && amount <= creditBalance;
}

/**
 * El monto es positivo pero no cubre el saldo de la cuota actual (pago parcial).
 * @param amount Monto total ingresado.
 * @param installmentBalance Saldo pendiente de la cuota actual.
 */
export function isPartialPayment(
  amount: number,
  installmentBalance: number,
): boolean {
  return amount > 0 && amount < installmentBalance;
}
