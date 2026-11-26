import { paymentMethodLabel, splitAmountByMethod } from './payment-method-labels';

describe('paymentMethodLabel', () => {
  it('traduce los métodos conocidos', () => {
    expect(paymentMethodLabel('CASH')).toBe('Efectivo');
    expect(paymentMethodLabel('TRANSFER')).toBe('Transferencia');
    expect(paymentMethodLabel('MIXED')).toBe('Mixto');
  });

  it('no etiqueta desconocidos como Transferencia', () => {
    expect(paymentMethodLabel('OTRO')).toBe('—');
    expect(paymentMethodLabel(null)).toBe('—');
    expect(paymentMethodLabel(undefined, 'Sin método')).toBe('Sin método');
  });
});

describe('splitAmountByMethod', () => {
  it('CASH lleva todo a efectivo', () => {
    expect(splitAmountByMethod('CASH', 100, 30, 70)).toEqual({
      amountCash: 100,
      amountTransfer: 0,
    });
  });

  it('TRANSFER lleva todo a transferencia', () => {
    expect(splitAmountByMethod('TRANSFER', 100)).toEqual({ amountCash: 0, amountTransfer: 100 });
  });

  it('MIXED respeta los parciales', () => {
    expect(splitAmountByMethod('MIXED', 100, 30, 70)).toEqual({
      amountCash: 30,
      amountTransfer: 70,
    });
  });
});
