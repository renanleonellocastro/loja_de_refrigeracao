import { describe, expect, it } from 'vitest';
import type { RatchetResult } from '../src/ratchet.js';
import { formatList, formatRatchet } from '../src/report.js';

const violation = (name: string, length: number, line = 1) => ({ path: 'a.ts', line, name, length });

function resultWith(overrides: Partial<RatchetResult>): RatchetResult {
  return { violations: [], unlisted: [], grown: [], shrinkable: 0, baselineTotal: 0, ...overrides };
}

describe('formatList', () => {
  it('sorts the longest first, then by path and line', () => {
    const list = formatList([
      violation('b', 13, 9),
      violation('a', 30),
      violation('c', 13, 2),
      { ...violation('d', 13), path: '0.ts' },
    ]);

    expect(list).toEqual(['  a.ts:1 a 30', '  0.ts:1 d 13', '  a.ts:2 c 13', '  a.ts:9 b 13']);
  });
});

describe('formatRatchet', () => {
  it('lists new and grown functions and the room to shrink', () => {
    const lines = formatRatchet(
      resultWith({
        violations: [violation('a', 14)],
        unlisted: [violation('a', 14)],
        grown: [{ measurement: violation('b', 21), baselineLength: 20 }],
        shrinkable: 3,
        baselineTotal: 5,
      }),
      12,
    );

    expect(lines).toEqual([
      'Funções com corpo acima de 12 linhas: 1 (linha de base: 5)',
      'Novas acima do limite ou fora da linha de base: 1',
      '  a.ts:1 a 14',
      'Cresceram desde a linha de base: 1',
      '  a.ts:1 b 21 (era 20)',
      'A linha de base pode encolher em 3 entradas: rode make function-length-baseline.',
    ]);
  });

  it('omits the shrink hint when the baseline is tight', () => {
    expect(formatRatchet(resultWith({}), 12).some((line) => line.includes('encolher'))).toBe(false);
  });
});
