import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildMatrix, type Matrix } from './matrix.js';
import { renderMatrix } from './render.js';
import { parseRequirements } from './requirements.js';
import { collectTests, type Report } from './tests.js';

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REQUIREMENTS_PATH = path.join(REPOSITORY_ROOT, 'docs/REQUISITOS.md');
export const MATRIX_PATH = path.join(REPOSITORY_ROOT, 'docs/RASTREABILIDADE.md');
const SUCCESS = 0;
const FAILURE = 1;
const REGENERATE = 'Rode `make traceability` e faça commit de docs/RASTREABILIDADE.md.';

export interface Arguments {
  readonly check: boolean;
  readonly report: string;
}

export interface Io {
  readonly read: (file: string) => string | undefined;
  readonly writeFile: (file: string, text: string) => void;
  readonly write: (text: string) => void;
}

export function parseArguments(argv: readonly string[]): Arguments {
  const index = argv.indexOf('--report');
  const report = index === -1 ? undefined : argv[index + 1];
  if (!report) throw new Error('Informe o relatório JSON do Playwright com --report <arquivo>.');
  return { check: argv.includes('--check'), report: path.resolve(report) };
}

function gaps(matrix: Matrix): string[] {
  return [
    ...matrix.uncovered.map((id) => `${id} não tem teste E2E com a tag @${id}.`),
    ...matrix.unknownTags.map((id) => `A tag @${id} não existe em docs/REQUISITOS.md.`),
  ];
}

function problemsOf(
  matrix: Matrix,
  rendered: string,
  committed: string | undefined,
  check: boolean,
): string[] {
  const stale =
    check && rendered !== committed ? [`docs/RASTREABILIDADE.md está desatualizado. ${REGENERATE}`] : [];
  return [...gaps(matrix), ...stale];
}

function readRequired(io: Io, file: string): string {
  const text = io.read(file);
  if (text === undefined) throw new Error(`Arquivo não encontrado: ${file}`);
  return text;
}

function matrixOf(args: Arguments, io: Io): Matrix {
  const requirements = parseRequirements(readRequired(io, REQUIREMENTS_PATH));
  const report = JSON.parse(readRequired(io, args.report)) as Report;
  return buildMatrix(requirements, collectTests(report));
}

/** Writes the matrix, or with --check only compares it with the committed one; fails on any gap. */
export function run(args: Arguments, io: Io): number {
  const matrix = matrixOf(args, io);
  const rendered = renderMatrix(matrix);
  if (!args.check) io.writeFile(MATRIX_PATH, rendered);
  const problems = problemsOf(matrix, rendered, io.read(MATRIX_PATH), args.check);
  const covered = matrix.rows.length - matrix.uncovered.length;
  io.write(`${covered} de ${matrix.rows.length} requisitos com teste E2E.`);
  problems.forEach((problem) => io.write(problem));
  return problems.length === 0 ? SUCCESS : FAILURE;
}

export function readIfPresent(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

/** The real file system and standard output. */
export const nodeIo: Io = {
  read: readIfPresent,
  writeFile: (file, text) => writeFileSync(file, text),
  write: (text) => process.stdout.write(`${text}\n`),
};

/* v8 ignore next 3 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = run(parseArguments(process.argv.slice(2)), nodeIo);
}
