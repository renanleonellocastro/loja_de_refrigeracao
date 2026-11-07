import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MATRIX_PATH, nodeIo, parseArguments, readIfPresent, run, type Io } from '../src/cli.js';

const REQUIREMENTS = '* **RF-01** Um\n* **RF-02** Dois\n';
const REPORT_PATH = '/tmp/report.json';

function reportWith(tags: string[][]): string {
  const specs = tags.map((list, index) => ({ title: `t${index}`, file: 'a.spec.ts', tags: list }));
  return JSON.stringify({ suites: [{ title: 'a.spec.ts', specs }] });
}

function fakeIo(files: Record<string, string>) {
  const output: string[] = [];
  const written: Record<string, string> = {};
  const io: Io = {
    read: (file) => (file.endsWith('REQUISITOS.md') ? REQUIREMENTS : files[file]),
    writeFile: (file, text) => {
      written[file] = text;
      files[file] = text;
    },
    write: (text) => output.push(text),
  };
  return { io, output, written };
}

describe('parseArguments', () => {
  it('reads the report path and the check flag', () => {
    expect(parseArguments(['--check', '--report', REPORT_PATH])).toEqual({
      check: true,
      report: REPORT_PATH,
    });
    expect(parseArguments(['--report', REPORT_PATH]).check).toBe(false);
  });

  it('requires the report', () => {
    expect(() => parseArguments([])).toThrow('--report');
    expect(() => parseArguments(['--report'])).toThrow('--report');
  });
});

describe('run', () => {
  it('writes the matrix and succeeds when every requirement has a test', () => {
    const { io, output, written } = fakeIo({ [REPORT_PATH]: reportWith([['RF-01'], ['RF-02']]) });

    expect(run({ check: false, report: REPORT_PATH }, io)).toBe(0);
    expect(written[MATRIX_PATH]).toContain('| RF-02 | Dois |');
    expect(output).toEqual(['2 de 2 requisitos com teste E2E.']);
  });

  it('fails on a requirement without a test and on an unknown tag', () => {
    const { io, output } = fakeIo({ [REPORT_PATH]: reportWith([['RF-01', 'RF-77']]) });

    expect(run({ check: false, report: REPORT_PATH }, io)).toBe(1);
    expect(output).toEqual([
      '1 de 2 requisitos com teste E2E.',
      'RF-02 não tem teste E2E com a tag @RF-02.',
      'A tag @RF-77 não existe em docs/REQUISITOS.md.',
    ]);
  });

  it('in check mode compares with the committed matrix without writing it', () => {
    const report = reportWith([['RF-01', 'RF-02']]);
    const fresh = fakeIo({ [REPORT_PATH]: report });
    run({ check: false, report: REPORT_PATH }, fresh.io);
    const committed = fresh.written[MATRIX_PATH]!;

    const current = fakeIo({ [REPORT_PATH]: report, [MATRIX_PATH]: committed });
    expect(run({ check: true, report: REPORT_PATH }, current.io)).toBe(0);
    expect(current.written).toEqual({});

    const stale = fakeIo({ [REPORT_PATH]: report, [MATRIX_PATH]: 'old' });
    expect(run({ check: true, report: REPORT_PATH }, stale.io)).toBe(1);
    expect(stale.output.at(-1)).toContain('desatualizado');
  });

  it('requires the report file', () => {
    const { io } = fakeIo({});

    expect(() => run({ check: true, report: REPORT_PATH }, io)).toThrow(
      `Arquivo não encontrado: ${REPORT_PATH}`,
    );
  });
});

describe('nodeIo', () => {
  it('reads and writes files and tells a missing file apart', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'traceability-'));
    const file = path.join(directory, 'matrix.md');

    expect(readIfPresent(file)).toBeUndefined();
    nodeIo.writeFile(file, 'texto');
    expect(nodeIo.read(file)).toBe('texto');
  });

  it('writes a line to the standard output', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    nodeIo.write('linha');

    expect(spy).toHaveBeenCalledWith('linha\n');
    spy.mockRestore();
  });
});
