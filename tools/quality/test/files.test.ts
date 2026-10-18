import { rmSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { isProductionFile, listRepositoryFiles } from '../src/files.js';
import { createRepository } from './repository.js';

const config = loadConfig();

describe('isProductionFile', () => {
  it.each([
    ['apps/api/src/app.ts', true],
    ['apps/web/app/pages/index.vue', true],
    ['packages/brand/illustrations/lib.cjs', true],
    ['infra/dev.mjs', true],
    ['apps/api/src/app.test.ts', false],
    ['apps/api/test/helpers.ts', false],
    ['packages/contracts/src/generated/api.ts', false],
    ['apps/web/nuxt.config.ts', false],
    ['apps/web/app/env.d.ts', false],
    ['apps/e2e/tests/home.spec.ts', false],
    ['apps/api/src/readme.md', false],
  ])('%s is production code: %s', (file, expected) => {
    expect(isProductionFile(file, config)).toBe(expected);
  });
});

describe('listRepositoryFiles', () => {
  it('lists untracked files and skips deleted ones', () => {
    const root = createRepository({ 'a.ts': '', 'b/c.vue': '', 'gone.ts': '' });
    rmSync(path.join(root, 'gone.ts'));

    expect(listRepositoryFiles(root).sort()).toEqual(['a.ts', 'b/c.vue']);
  });
});
