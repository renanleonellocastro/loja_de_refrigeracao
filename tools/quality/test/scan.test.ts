import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { findViolations, measureFile, scriptsOf } from '../src/scan.js';
import { createRepository, functionWithBody } from './repository.js';

describe('scriptsOf', () => {
  it.each([
    ['a.ts', 'ts'],
    ['a.mts', 'ts'],
    ['a.tsx', 'tsx'],
    ['a.mjs', 'js'],
    ['a.cjs', 'js'],
    ['a.jsx', 'jsx'],
  ])('reads %s as %s', (file, language) => {
    expect(scriptsOf(file, '').map((script) => script.language)).toEqual([language]);
  });

  it('reads the script blocks of a Vue component', () => {
    expect(scriptsOf('a.vue', '<script setup lang="ts">\nconst a = 1;\n</script>')).toHaveLength(1);
  });
});

describe('findViolations', () => {
  it('reports only production functions past the limit', () => {
    const root = createRepository({
      'apps/api/src/long.ts': functionWithBody('long', 13),
      'apps/api/src/short.ts': functionWithBody('short', 12),
      'apps/api/src/long.test.ts': functionWithBody('ignored', 20),
      'apps/web/app/Long.vue': `<script setup lang="ts">\n${functionWithBody('handler', 14)}</script>\n`,
    });

    const violations = findViolations(root, loadConfig());

    expect(violations.map(({ path, name, length }) => [path, name, length])).toEqual([
      ['apps/api/src/long.ts', 'long', 13],
      ['apps/web/app/Long.vue', 'handler', 14],
    ]);
  });

  it('measures every function of a file', () => {
    const root = createRepository({ 'a.ts': functionWithBody('first', 1) + functionWithBody('second', 2) });

    expect(measureFile(root, 'a.ts').map(({ length }) => length)).toEqual([1, 2]);
  });
});
