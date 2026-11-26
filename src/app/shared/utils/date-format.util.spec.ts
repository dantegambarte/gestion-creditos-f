import { formatIsoDate } from './date-format.util';

describe('formatIsoDate', () => {
  it('formats a date-only ISO string as DD/MM/YYYY', () => {
    expect(formatIsoDate('2026-03-09')).toBe('09/03/2026');
  });

  it('ignores the time part of a datetime ISO string', () => {
    expect(formatIsoDate('2026-03-09T23:30:00.000Z')).toBe('09/03/2026');
  });

  it('returns an em dash for empty values', () => {
    expect(formatIsoDate('')).toBe('—');
    expect(formatIsoDate(null)).toBe('—');
    expect(formatIsoDate(undefined)).toBe('—');
  });
});
