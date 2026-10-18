import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBaseline, toBaseline, writeBaseline } from '../src/baseline.js';

const violation = (file: string, name: string, length: number) => ({ path: file, line: 1, name, length });

describe('baseline', () => {
  it('drops line numbers and sorts by path, name and longest first', () => {
    const baseline = toBaseline(
      [
        violation('b.ts', 'x', 20),
        violation('a.ts', 'y', 14),
        violation('a.ts', 'y', 30),
        violation('a.ts', 'w', 13),
      ],
      12,
    );

    expect(baseline).toEqual({
      limit: 12,
      total: 4,
      functions: [
        { path: 'a.ts', name: 'w', length: 13 },
        { path: 'a.ts', name: 'y', length: 30 },
        { path: 'a.ts', name: 'y', length: 14 },
        { path: 'b.ts', name: 'x', length: 20 },
      ],
    });
  });

  it('reads an empty baseline when the file does not exist', () => {
    expect(readBaseline('/nonexistent/baseline.json', 12)).toEqual({ limit: 12, total: 0, functions: [] });
  });

  it('reads back what it writes', () => {
    const baselinePath = path.join(mkdtempSync(path.join(tmpdir(), 'baseline-')), 'baseline.json');
    const baseline = toBaseline([violation('a.ts', 'y', 14)], 12);

    writeBaseline(baselinePath, baseline);

    expect(readBaseline(baselinePath, 12)).toEqual(baseline);
  });
});
