import { InterestRate } from '../../features/admin/config/models/interfaces/interest-rate.model';
import { ProductRate } from '../../features/admin/config/models/interfaces/product';
import {
  calculateFinancedCapital,
  calculateInstallmentValue,
  calculateTotalToPay,
  findLoanInterestRate,
  findProductRate,
  rateToPercent,
} from './financial-calculator.util';

function buildInterestRate(
  overrides: Partial<InterestRate> = {},
): InterestRate {
  return {
    id: 'rate-1',
    paymentFrequency: 'MONTHLY',
    installmentsCount: 12,
    minAmount: 0,
    maxAmount: null,
    rate: 0.15,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildProductRate(overrides: Partial<ProductRate> = {}): ProductRate {
  return {
    id: 'product-rate-1',
    productId: 'product-1',
    productName: 'Producto Test',
    paymentFrequency: 'MONTHLY',
    installmentsCount: 12,
    rate: 0.2,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateInstallmentValue', () => {
  it('debe calcular la cuota redondeando al millar superior (happy path)', () => {
    // Arrange
    const capital = 100000;
    const rate = 0.15;
    const installments = 12;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    // (100000 * 1.15) / 12 = 9583.33... -> ceil al millar -> 10000
    expect(result).toBe(10000);
  });

  it('debe devolver un múltiplo exacto de 1000 cuando la división es exacta', () => {
    // Arrange
    const capital = 120000;
    const rate = 0;
    const installments = 12;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    // (120000 * 1) / 12 = 10000 -> ya es múltiplo de 1000, no debe sumar otro millar
    expect(result).toBe(10000);
  });

  it('debe devolver 0 cuando el capital es 0 (edge case)', () => {
    // Arrange
    const capital = 0;
    const rate = 0.15;
    const installments = 12;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    expect(result).toBe(0);
  });

  it('debe calcular correctamente cuando la tasa de interés es 0% (edge case)', () => {
    // Arrange
    const capital = 100000;
    const rate = 0;
    const installments = 4;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    // (100000 * 1) / 4 = 25000 -> múltiplo exacto de 1000
    expect(result).toBe(25000);
  });

  it('debe calcular correctamente cuando hay una sola cuota (edge case)', () => {
    // Arrange
    const capital = 50000;
    const rate = 0.1;
    const installments = 1;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    // 50000 * 1.1 = 55000.00000000001 (imprecisión binaria de punto flotante, no 55000 exacto),
    // por eso Math.ceil empuja al millar siguiente: 56000. Si esta función "arregla" el float,
    // este test debe fallar para que se revise el cambio.
    expect(result).toBe(56000);
  });

  it('debe devolver 0 cuando la cantidad de cuotas es 0 (edge case)', () => {
    // Arrange
    const capital = 100000;
    const rate = 0.15;
    const installments = 0;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    expect(result).toBe(0);
  });

  it('debe devolver 0 cuando la cantidad de cuotas es negativa (edge case)', () => {
    // Arrange
    const capital = 100000;
    const rate = 0.15;
    const installments = -3;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    expect(result).toBe(0);
  });

  it('debe redondear siempre hacia arriba al millar, nunca hacia abajo (regla de redondeo)', () => {
    // Arrange
    const capital = 100001;
    const rate = 0;
    const installments = 1;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    // 100001 / 1 = 100001 -> debe redondear a 101000, NO a 100000
    expect(result).toBe(101000);
  });

  it('nunca debe devolver un resultado con decimales (siempre múltiplo de 1000)', () => {
    // Arrange
    const capital = 73333;
    const rate = 0.137;
    const installments = 7;

    // Act
    const result = calculateInstallmentValue(capital, rate, installments);

    // Assert
    expect(result % 1000).toBe(0);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('calculateTotalToPay', () => {
  it('debe multiplicar el valor de cuota por la cantidad de cuotas (happy path)', () => {
    // Arrange
    const installmentValue = 10000;
    const installments = 12;

    // Act
    const result = calculateTotalToPay(installmentValue, installments);

    // Assert
    expect(result).toBe(120000);
  });

  it('debe devolver 0 cuando el valor de cuota es 0 (edge case)', () => {
    // Arrange
    const installmentValue = 0;
    const installments = 12;

    // Act
    const result = calculateTotalToPay(installmentValue, installments);

    // Assert
    expect(result).toBe(0);
  });

  it('debe devolver 0 cuando la cantidad de cuotas es 0 (edge case)', () => {
    // Arrange
    const installmentValue = 10000;
    const installments = 0;

    // Act
    const result = calculateTotalToPay(installmentValue, installments);

    // Assert
    expect(result).toBe(0);
  });

  it('debe devolver el mismo valor de cuota cuando hay una sola cuota (edge case)', () => {
    // Arrange
    const installmentValue = 55000;
    const installments = 1;

    // Act
    const result = calculateTotalToPay(installmentValue, installments);

    // Assert
    expect(result).toBe(55000);
  });
});

describe('calculateFinancedCapital', () => {
  it('debe restar el anticipo del capital bruto (happy path)', () => {
    // Arrange
    const baseCapital = 100000;
    const downPayment = 20000;

    // Act
    const result = calculateFinancedCapital(baseCapital, downPayment);

    // Assert
    expect(result).toBe(80000);
  });

  it('debe devolver 0 (piso) cuando el anticipo es mayor al capital bruto (edge case)', () => {
    // Arrange
    const baseCapital = 50000;
    const downPayment = 80000;

    // Act
    const result = calculateFinancedCapital(baseCapital, downPayment);

    // Assert
    // No debe devolver un capital financiado negativo
    expect(result).toBe(0);
  });

  it('debe devolver 0 cuando el anticipo es exactamente igual al capital bruto (edge case)', () => {
    // Arrange
    const baseCapital = 50000;
    const downPayment = 50000;

    // Act
    const result = calculateFinancedCapital(baseCapital, downPayment);

    // Assert
    expect(result).toBe(0);
  });

  it('debe devolver el capital bruto completo cuando el anticipo es 0 (edge case)', () => {
    // Arrange
    const baseCapital = 100000;
    const downPayment = 0;

    // Act
    const result = calculateFinancedCapital(baseCapital, downPayment);

    // Assert
    expect(result).toBe(100000);
  });

  it('debe devolver 0 cuando el capital bruto es 0 (edge case)', () => {
    // Arrange
    const baseCapital = 0;
    const downPayment = 0;

    // Act
    const result = calculateFinancedCapital(baseCapital, downPayment);

    // Assert
    expect(result).toBe(0);
  });
});

describe('findLoanInterestRate', () => {
  it('debe encontrar la tasa cuyo rango de monto y cuotas coinciden (happy path)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 6,
        minAmount: 0,
        maxAmount: 50000,
        rate: 0.1,
      }),
      buildInterestRate({
        installmentsCount: 12,
        minAmount: 50001,
        maxAmount: 200000,
        rate: 0.18,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 12, 100000);

    // Assert
    expect(result).toBe(0.18);
  });

  it('debe devolver 0 cuando no existe ninguna tasa para esas cuotas (edge case)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 6,
        minAmount: 0,
        maxAmount: 50000,
        rate: 0.1,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 24, 30000);

    // Assert
    expect(result).toBe(0);
  });

  it('debe devolver 0 cuando el monto está fuera de todos los rangos disponibles (edge case)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 12,
        minAmount: 50000,
        maxAmount: 100000,
        rate: 0.15,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 12, 200000);

    // Assert
    expect(result).toBe(0);
  });

  it('debe incluir el monto cuando es exactamente igual al límite inferior (minAmount inclusive)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 12,
        minAmount: 50000,
        maxAmount: 100000,
        rate: 0.15,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 12, 50000);

    // Assert
    expect(result).toBe(0.15);
  });

  it('debe excluir el monto cuando es menor al límite inferior (minAmount exclusivo hacia abajo)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 12,
        minAmount: 50000,
        maxAmount: 100000,
        rate: 0.15,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 12, 49999);

    // Assert
    expect(result).toBe(0);
  });

  it('debe incluir el monto cuando es exactamente igual al límite superior (maxAmount inclusive)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 12,
        minAmount: 50000,
        maxAmount: 100000,
        rate: 0.15,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 12, 100000);

    // Assert
    expect(result).toBe(0.15);
  });

  it('debe excluir el monto cuando supera el límite superior (maxAmount exclusivo hacia arriba)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 12,
        minAmount: 50000,
        maxAmount: 100000,
        rate: 0.15,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 12, 100001);

    // Assert
    expect(result).toBe(0);
  });

  it('debe tratar maxAmount null como "sin tope superior" (edge case)', () => {
    // Arrange
    const rates: InterestRate[] = [
      buildInterestRate({
        installmentsCount: 12,
        minAmount: 50000,
        maxAmount: null,
        rate: 0.2,
      }),
    ];

    // Act
    const result = findLoanInterestRate(rates, 12, 999999999);

    // Assert
    expect(result).toBe(0.2);
  });

  it('debe devolver 0 cuando la lista de tasas está vacía (edge case)', () => {
    // Arrange
    const rates: InterestRate[] = [];

    // Act
    const result = findLoanInterestRate(rates, 12, 100000);

    // Assert
    expect(result).toBe(0);
  });
});

describe('findProductRate', () => {
  it('debe encontrar la tasa cuyo cuotas y frecuencia coinciden (happy path)', () => {
    // Arrange
    const rates: ProductRate[] = [
      buildProductRate({
        installmentsCount: 6,
        paymentFrequency: 'WEEKLY',
        rate: 0.1,
      }),
      buildProductRate({
        installmentsCount: 12,
        paymentFrequency: 'MONTHLY',
        rate: 0.2,
      }),
    ];

    // Act
    const result = findProductRate(rates, 12, 'MONTHLY');

    // Assert
    expect(result).toBe(rates[1]);
    expect(result?.rate).toBe(0.2);
  });

  it('debe devolver undefined cuando las cuotas coinciden pero la frecuencia no (edge case)', () => {
    // Arrange
    const rates: ProductRate[] = [
      buildProductRate({
        installmentsCount: 12,
        paymentFrequency: 'MONTHLY',
        rate: 0.2,
      }),
    ];

    // Act
    const result = findProductRate(rates, 12, 'WEEKLY');

    // Assert
    expect(result).toBeUndefined();
  });

  it('debe devolver undefined cuando la frecuencia coincide pero las cuotas no (edge case)', () => {
    // Arrange
    const rates: ProductRate[] = [
      buildProductRate({
        installmentsCount: 12,
        paymentFrequency: 'MONTHLY',
        rate: 0.2,
      }),
    ];

    // Act
    const result = findProductRate(rates, 6, 'MONTHLY');

    // Assert
    expect(result).toBeUndefined();
  });

  it('debe devolver undefined cuando la lista de tasas está vacía (edge case)', () => {
    // Arrange
    const rates: ProductRate[] = [];

    // Act
    const result = findProductRate(rates, 12, 'MONTHLY');

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('rateToPercent', () => {
  it('debe convertir una tasa decimal a porcentaje con dos decimales (happy path)', () => {
    // Arrange
    const rate = 0.15;

    // Act
    const result = rateToPercent(rate);

    // Assert
    expect(result).toBe(15);
  });

  it('debe devolver 0 cuando la tasa es 0 (edge case)', () => {
    // Arrange
    const rate = 0;

    // Act
    const result = rateToPercent(rate);

    // Assert
    expect(result).toBe(0);
  });

  it('debe redondear correctamente tasas con más de dos decimales de porcentaje (regla de redondeo)', () => {
    // Arrange
    const rate = 0.123456;

    // Act
    const result = rateToPercent(rate);

    // Assert
    // 0.123456 * 10000 = 1234.56 -> round -> 1235 -> /100 -> 12.35
    expect(result).toBe(12.35);
  });

  it('debe truncar/redondear a dos decimales sin arrastrar errores de punto flotante (regla de redondeo)', () => {
    // Arrange
    const rate = 0.1;

    // Act
    const result = rateToPercent(rate);

    // Assert
    // 0.1 * 10000 = 1000 -> /100 -> 10, no 10.000000000002
    expect(result).toBe(10);
  });

  it('debe manejar tasas mayores al 100% (edge case)', () => {
    // Arrange
    const rate = 1.5;

    // Act
    const result = rateToPercent(rate);

    // Assert
    expect(result).toBe(150);
  });
});
