import { buildBatchFailureMessages } from './batch-failure-messages';

describe('buildBatchFailureMessages', () => {
  it('un 500 se informa como error y no como "Sin cuotas"', () => {
    const msgs = buildBatchFailureMessages([
      { collectorName: 'Ana', error: { status: 500, message: 'boom' } },
    ]);
    expect(msgs.length).toBe(1);
    expect(msgs[0].severity).toBe('error');
    expect(msgs[0].summary).not.toBe('Sin cuotas');
    expect(msgs[0].detail).toContain('Ana');
  });

  it('un 409 se informa como "Sin cuotas" y separa errores reales', () => {
    const msgs = buildBatchFailureMessages([
      { collectorName: 'Ana', error: { status: 409 } },
      { collectorName: 'Beto', error: { status: 0 } },
    ]);
    expect(msgs.map((m) => m.severity)).toEqual(['error', 'warn']);
    expect(msgs[1].summary).toBe('Sin cuotas');
    expect(msgs[1].detail).toContain('Ana');
    expect(msgs[0].detail).toContain('Beto');
  });

  it('sin fallos no genera mensajes', () => {
    expect(buildBatchFailureMessages([])).toEqual([]);
  });
});
