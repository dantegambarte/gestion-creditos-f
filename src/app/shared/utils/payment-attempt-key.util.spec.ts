import { PaymentAttemptKey } from './payment-attempt-key.util';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('PaymentAttemptKey', () => {
  it('genera un UUID v4', () => {
    expect(new PaymentAttemptKey().forAttempt({ a: 1 })).toMatch(UUID_RE);
  });

  it('reutiliza la misma clave en el reintento del mismo cobro', () => {
    const k = new PaymentAttemptKey();
    expect(k.forAttempt({ installmentId: 'i1', amount: 100 })).toBe(
      k.forAttempt({ installmentId: 'i1', amount: 100 }),
    );
  });

  it('genera otra clave si cambian los datos del cobro', () => {
    const k = new PaymentAttemptKey();
    const first = k.forAttempt({ installmentId: 'i1', amount: 100 });
    expect(k.forAttempt({ installmentId: 'i1', amount: 200 })).not.toBe(first);
  });

  it('genera otra clave después de reset (cobro nuevo)', () => {
    const k = new PaymentAttemptKey();
    const first = k.forAttempt({ installmentId: 'i1', amount: 100 });
    k.reset();
    expect(k.forAttempt({ installmentId: 'i1', amount: 100 })).not.toBe(first);
  });
});
