import { describe, expect, it } from 'vitest';
import { buildMatrix } from '../src/matrix.js';

const requirements = [
  { id: 'RF-01', text: 'Um' },
  { id: 'RF-02', text: 'Dois' },
];

describe('buildMatrix', () => {
  it('maps each requirement to its tests and reports the gaps both ways', () => {
    const tests = [
      { file: 'a.spec.ts', title: 'a', requirements: ['RF-01', 'RF-09'] },
      { file: 'b.spec.ts', title: 'b', requirements: ['RF-08'] },
    ];

    const matrix = buildMatrix(requirements, tests);

    expect(matrix.rows.map((row) => row.tests.length)).toEqual([1, 0]);
    expect(matrix.uncovered).toEqual(['RF-02']);
    expect(matrix.unknownTags).toEqual(['RF-08', 'RF-09']);
  });
});
