import { TestBed } from '@angular/core/testing';
import { PaymentAttemptKeys } from './payment-attempt-key.util';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('PaymentAttemptKeys', () => {
  let keys: PaymentAttemptKeys;
  const attempt = { installmentId: 'i1', amount: 100 };

  beforeEach(() => {
    keys = TestBed.inject(PaymentAttemptKeys);
  });

  it('genera un UUID v4', () => {
    expect(keys.keyFor(attempt)).toMatch(UUID_RE);
  });

  it('reutiliza la misma clave en el reintento del mismo cobro', () => {
    expect(keys.keyFor(attempt)).toBe(keys.keyFor({ installmentId: 'i1', amount: 100 }));
  });

  it('la clave sobrevive entre instancias de diálogo (servicio root compartido)', () => {
    const first = keys.keyFor(attempt);
    expect(TestBed.inject(PaymentAttemptKeys).keyFor(attempt)).toBe(first);
  });

  it('genera otra clave si cambia el monto, la cuota o el tipo', () => {
    const first = keys.keyFor(attempt);
    expect(keys.keyFor({ installmentId: 'i1', amount: 200 })).not.toBe(first);
    expect(keys.keyFor({ installmentId: 'i2', amount: 100 })).not.toBe(first);
    expect(keys.keyFor({ ...attempt, generationType: 'RENEWAL' })).not.toBe(first);
  });

  it('normaliza el monto a centavos (100 y 100.001 son el mismo cobro)', () => {
    expect(keys.keyFor({ installmentId: 'i1', amount: 100.001 })).toBe(keys.keyFor(attempt));
  });

  it('genera otra clave después de settle (cobro confirmado)', () => {
    const first = keys.keyFor(attempt);
    keys.settle(attempt);
    expect(keys.keyFor(attempt)).not.toBe(first);
  });
});
