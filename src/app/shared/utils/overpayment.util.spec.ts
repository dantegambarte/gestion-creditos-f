import {
  advancesNextInstallments,
  exceedsCreditBalance,
  isPartialPayment,
} from './overpayment.util';

describe('overpayment.util', () => {
  // Cuota de 1000, crédito con saldo total de 5000.
  const CUOTA = 1000;
  const CREDITO = 5000;

  describe('exceedsCreditBalance', () => {
    it('es false cuando el monto no supera el saldo del crédito', () => {
      expect(exceedsCreditBalance(5000, CREDITO)).toBeFalse();
      expect(exceedsCreditBalance(4999, CREDITO)).toBeFalse();
    });

    it('es true cuando el monto supera el saldo del crédito', () => {
      expect(exceedsCreditBalance(5001, CREDITO)).toBeTrue();
    });
  });

  describe('advancesNextInstallments', () => {
    it('es true cuando supera la cuota pero no el saldo del crédito', () => {
      expect(advancesNextInstallments(2000, CUOTA, CREDITO)).toBeTrue();
    });

    it('es false cuando el monto no supera la cuota', () => {
      expect(advancesNextInstallments(1000, CUOTA, CREDITO)).toBeFalse();
      expect(advancesNextInstallments(500, CUOTA, CREDITO)).toBeFalse();
    });

    it('es false cuando el monto supera el saldo del crédito (inválido)', () => {
      expect(advancesNextInstallments(6000, CUOTA, CREDITO)).toBeFalse();
    });

    it('en la última cuota (saldo cuota == saldo crédito) nunca adelanta', () => {
      expect(advancesNextInstallments(1500, 1000, 1000)).toBeFalse();
      expect(advancesNextInstallments(1000, 1000, 1000)).toBeFalse();
    });
  });

  describe('isPartialPayment', () => {
    it('es true cuando el monto es positivo y menor a la cuota', () => {
      expect(isPartialPayment(500, CUOTA)).toBeTrue();
    });

    it('es false cuando cubre o supera la cuota', () => {
      expect(isPartialPayment(1000, CUOTA)).toBeFalse();
      expect(isPartialPayment(2000, CUOTA)).toBeFalse();
    });

    it('es false cuando el monto es 0 o negativo', () => {
      expect(isPartialPayment(0, CUOTA)).toBeFalse();
      expect(isPartialPayment(-100, CUOTA)).toBeFalse();
    });
  });
});
