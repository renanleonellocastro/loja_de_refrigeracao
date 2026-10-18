import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_PATH, loadConfig, REPOSITORY_ROOT } from '../src/config.js';

describe('loadConfig', () => {
  it('reads the repository settings by default', () => {
    const config = loadConfig();

    expect(config.limit).toBe(12);
    expect(config.roots).toContain('apps/api/src/');
    expect(CONFIG_PATH.startsWith(REPOSITORY_ROOT)).toBe(true);
  });

  it('turns directories into a set and file patterns into regular expressions', () => {
    const configPath = path.join(mkdtempSync(path.join(tmpdir(), 'config-')), 'config.json');
    const raw = {
      limit: 5,
      roots: ['src/'],
      excludedDirectories: ['test'],
      excludedFilePatterns: ['\\.spec\\.ts$'],
    };
    writeFileSync(configPath, JSON.stringify(raw));

    const config = loadConfig(configPath);

    expect(config.limit).toBe(5);
    expect(config.excludedDirectories.has('test')).toBe(true);
    expect(config.excludedFiles[0]?.test('src/a.spec.ts')).toBe(true);
  });
});
