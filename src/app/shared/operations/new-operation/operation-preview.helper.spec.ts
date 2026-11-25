import { SimulateResult } from '../../../features/seller/models/credit.model';
import { CartLine } from './operation-form.service';
import {
  addFrequencyPeriods,
  buildSchedulePreview,
  getCartTotal,
  getLineInstallmentValue,
  getPlanInstallmentsCount,
  paymentMethodLabel,
} from './operation-preview.helper';

/**
 * Construye una línea de carrito mínima para los tests del helper.
 * @param {Partial<CartLine>} overrides - campos a sobrescribir
 */
function buildLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productoId: 'p1',
    nombre: 'Prod',
    variantId: 'v1',
    variantLabel: 'Std',
    cantidad: 1,
    precio: 100000,
    subtotal: 100000,
    stockDisponible: 1,
    unitIds: [],
    unitCodes: [],
    productIds: [],
    selectedUnitIds: [],
    rates: [
      {
        installmentsCount: 4,
        paymentFrequency: 'MONTHLY',
        rate: 0.2,
      } as CartLine['rates'][number],
    ],
    selectedInstallments: 4,
    ...overrides,
  };
}

/**
 * Simulación del backend con 4 cuotas mensuales (fechas ya con día hábil).
 */
function buildSimulation(): SimulateResult {
  return {
    type: 'SALE',
    paymentFrequency: 'MONTHLY',
    installmentsCount: 4,
    totalAmount: 100000,
    installmentAmount: 30000,
    totalToReturn: 120000,
    note: '',
    schedule: [
      { installmentNumber: 1, dueDate: '2026-12-10', amount: 30000 },
      { installmentNumber: 2, dueDate: '2027-01-11', amount: 30000 },
      { installmentNumber: 3, dueDate: '2027-02-10', amount: 30000 },
      { installmentNumber: 4, dueDate: '2027-03-10', amount: 30000 },
    ],
  };
}

describe('operation-preview.helper (#50)', () => {
  it('calcula la cuota por línea con tasa y anticipo prorrateado', () => {
    const lineA = buildLine();
    const lineB = buildLine({ productoId: 'p2', precio: 100000, subtotal: 100000 });
    // Anticipo 50.000 sobre 200.000 → 25.000 por línea; (75.000 * 1.2) / 4 = 22.500 → 23.000.
    expect(getLineInstallmentValue(lineA, 'MONTHLY', 50000, 200000)).toBe(23000);
    expect(getLineInstallmentValue(lineB, 'MONTHLY', 0, 200000)).toBe(30000);
  });

  it('usa la cantidad de cuotas de la simulación y si no, la mayor del carrito', () => {
    const lines = [buildLine({ selectedInstallments: 3 }), buildLine({ selectedInstallments: 6 })];
    expect(getPlanInstallmentsCount('SALE', lines, null, null)).toBe(6);
    expect(getPlanInstallmentsCount('LOAN', lines, 5, null)).toBe(5);
    expect(getPlanInstallmentsCount('SALE', lines, null, buildSimulation())).toBe(4);
  });

  it('calcula el total de contado como precio por cantidad', () => {
    expect(
      getCartTotal([
        buildLine({ precio: 1000, cantidad: 2, subtotal: 2000 }),
        buildLine({ precio: 500 }),
      ]),
    ).toBe(2500);
  });

  it('avanza fechas diarias, semanales, quincenales y mensuales', () => {
    const base = new Date(2026, 0, 30);
    expect(addFrequencyPeriods(base, 'DAILY', 2)).toEqual(new Date(2026, 1, 1));
    expect(addFrequencyPeriods(base, 'WEEKLY', 1)).toEqual(new Date(2026, 1, 6));
    expect(addFrequencyPeriods(base, 'BIWEEKLY', 1)).toEqual(new Date(2026, 1, 13));
    expect(addFrequencyPeriods(new Date(2026, 0, 10), 'MONTHLY', 1)).toEqual(new Date(2026, 1, 10));
  });

  it('muestra MIXED como Efectivo + Transferencia', () => {
    expect(paymentMethodLabel('MIXED')).toBe('Efectivo + Transferencia');
    expect(paymentMethodLabel('TRANSFER')).toBe('Transferencia');
    expect(paymentMethodLabel('CASH')).toBe('Efectivo');
  });

  it('sin modo adelantado devuelve el cronograma de la simulación tal cual', () => {
    const rows = buildSchedulePreview({
      simulation: buildSimulation(),
      firstPaymentDate: null,
      frequency: 'MONTHLY',
      installmentsCount: 4,
      installmentValue: 30000,
      advancedCount: 2,
      isAdvanceMode: false,
      approvalDate: new Date(2026, 10, 25),
      limit: 4,
    });

    expect(rows.map((r) => r.dueDate)).toEqual([
      new Date(2026, 11, 10),
      new Date(2027, 0, 11),
      new Date(2027, 1, 10),
      new Date(2027, 2, 10),
    ]);
    expect(rows.every((r) => !r.isAdvanced)).toBeTrue();
    expect(rows.map((r) => r.amount)).toEqual([30000, 30000, 30000, 30000]);
  });

  it('en modo adelantado las adelantadas vencen al aprobar y las restantes ocupan los huecos', () => {
    const rows = buildSchedulePreview({
      simulation: buildSimulation(),
      firstPaymentDate: null,
      frequency: 'MONTHLY',
      installmentsCount: 4,
      installmentValue: 30000,
      advancedCount: 2,
      isAdvanceMode: true,
      approvalDate: new Date(2026, 10, 25),
      limit: 4,
    });

    expect(rows.map((r) => r.isAdvanced)).toEqual([true, true, false, false]);
    expect(rows.map((r) => r.dueDate)).toEqual([
      new Date(2026, 10, 25),
      new Date(2026, 10, 25),
      new Date(2026, 11, 10),
      new Date(2027, 0, 11),
    ]);
  });

  it('sin simulación calcula el cronograma local respetando la frecuencia DAILY', () => {
    const rows = buildSchedulePreview({
      simulation: null,
      firstPaymentDate: new Date(2026, 11, 1),
      frequency: 'DAILY',
      installmentsCount: 10,
      installmentValue: 1000,
      advancedCount: 0,
      isAdvanceMode: false,
      approvalDate: new Date(2026, 10, 25),
      limit: 3,
    });

    expect(rows.map((r) => r.dueDate)).toEqual([
      new Date(2026, 11, 1),
      new Date(2026, 11, 2),
      new Date(2026, 11, 3),
    ]);
  });
});
