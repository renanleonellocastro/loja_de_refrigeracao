import { describe, expect, it } from 'vitest';
import { collectTests, type Report } from '../src/tests.js';

const spec = (title: string, tags: string[], file = 'a.spec.ts') => ({ title, tags, file });

describe('collectTests', () => {
  it('walks nested suites, keeps the requirement tags and the tests that have one', () => {
    const report: Report = {
      suites: [
        {
          title: 'a.spec.ts',
          specs: [spec('top level', ['RF-01', 'smoke'])],
          suites: [
            {
              title: 'Conta',
              specs: [spec('entra', ['RF-02']), spec('untagged', [])],
              suites: [{ title: 'inner', specs: [spec('deep', ['RF-03'])] }],
            },
          ],
        },
        { title: 'empty.spec.ts' },
      ],
    };

    expect(collectTests(report)).toEqual([
      { file: 'a.spec.ts', title: 'top level', requirements: ['RF-01'] },
      { file: 'a.spec.ts', title: 'Conta › entra', requirements: ['RF-02'] },
      { file: 'a.spec.ts', title: 'inner › deep', requirements: ['RF-03'] },
    ]);
  });

  it('lists a test once even when several projects report it', () => {
    const suite = { title: 'b.spec.ts', specs: [spec('x', ['RF-04'], 'b.spec.ts')] };

    expect(collectTests({ suites: [suite, suite] })).toHaveLength(1);
  });
});
