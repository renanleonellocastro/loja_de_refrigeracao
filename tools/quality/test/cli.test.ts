import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { main, parseArguments } from '../src/cli.js';
import { BASELINE_PATH, REPOSITORY_ROOT } from '../src/config.js';
import { createRepository, functionWithBody, writeTree } from './repository.js';

function repositoryWithLongFunction(bodyLines = 13): { root: string; baselinePath: string } {
  const root = createRepository({ 'apps/api/src/long.ts': functionWithBody('long', bodyLines) });
  return { root, baselinePath: path.join(root, 'baseline.json') };
}

function run(argv: string[]): { status: number; output: string } {
  const output: string[] = [];
  const status = main(argv, (text) => output.push(text));
  return { status, output: output.join('\n') };
}

function baselinedLengths(baselinePath: string): number[] {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { functions: { length: number }[] };
  return baseline.functions.map(({ length }) => length);
}

describe('parseArguments', () => {
  it('runs the gate on this repository by default', () => {
    expect(parseArguments([])).toEqual({ mode: 'gate', root: REPOSITORY_ROOT, baselinePath: BASELINE_PATH });
  });

  it.each([
    [['--strict'], 'strict'],
    [['--write-baseline'], 'write-baseline'],
    [['--write-baseline', '--allow-growth'], 'force-baseline'],
    [['--list'], 'list'],
  ])('%j selects %s', (argv, mode) => {
    expect(parseArguments(argv).mode).toBe(mode);
  });

  it('resolves the root and baseline options and ignores a missing value', () => {
    const parsed = parseArguments(['--root', 'repo', '--baseline']);

    expect(parsed.root).toBe(path.resolve('repo'));
    expect(parsed.baselinePath).toBe(BASELINE_PATH);
  });
});

describe('main', () => {
  it('fails the gate on a function missing from the baseline', () => {
    const { root, baselinePath } = repositoryWithLongFunction();

    const { status, output } = run(['--root', root, '--baseline', baselinePath]);

    expect(status).toBe(1);
    expect(output).toContain('Catraca: FALHOU');
  });

  it('passes the gate once the function is baselined', () => {
    const { root, baselinePath } = repositoryWithLongFunction();
    run(['--root', root, '--baseline', baselinePath, '--allow-growth']);

    const { status, output } = run(['--root', root, '--baseline', baselinePath]);

    expect(status).toBe(0);
    expect(output).toContain('Catraca: OK');
  });

  it('only rewrites the baseline downward', () => {
    const { root, baselinePath } = repositoryWithLongFunction(20);
    run(['--root', root, '--baseline', baselinePath, '--allow-growth']);
    writeTree(root, { 'apps/api/src/long.ts': functionWithBody('long', 21) });

    expect(run(['--root', root, '--baseline', baselinePath, '--write-baseline']).status).toBe(1);
    writeTree(root, { 'apps/api/src/long.ts': functionWithBody('long', 15) });
    expect(run(['--root', root, '--baseline', baselinePath, '--write-baseline']).status).toBe(0);
    expect(baselinedLengths(baselinePath)).toEqual([15]);
  });

  it('fails strict mode on any long function and lists them', () => {
    const { root, baselinePath } = repositoryWithLongFunction();

    expect(run(['--root', root, '--strict']).status).toBe(1);
    expect(run(['--root', root, '--list']).output).toBe('  apps/api/src/long.ts:1 long 13');
    expect(existsSync(baselinePath)).toBe(false);
  });

  it('passes strict mode without long functions and prints to standard output by default', () => {
    const root = createRepository({ 'apps/api/src/short.ts': functionWithBody('short', 3) });
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(main(['--root', root, '--strict'])).toBe(0);
    expect(write).toHaveBeenCalledWith('Funções acima de 12 linhas: 0\n');
    write.mockRestore();
  });
});
