import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMoney, formatTimeRange } from './format.js';

describe('Brazilian formatting', () => {
  it('formats dates in São Paulo time', () => {
    expect(formatDateTime(new Date('2026-10-07T12:00:00Z'))).toBe('quarta-feira, 07/10, 09:00');
    expect(formatTimeRange(new Date('2026-10-07T12:00:00Z'), new Date('2026-10-07T14:30:00Z'))).toBe(
      '09:00 às 11:30',
    );
  });

  it('formats money from cents', () => {
    expect(formatMoney(123456)).toBe('R$ 1.234,56');
    expect(formatMoney(0)).toBe('R$ 0,00');
  });
});
