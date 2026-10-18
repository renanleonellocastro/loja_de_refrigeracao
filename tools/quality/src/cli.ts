import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBaseline, toBaseline, writeBaseline } from './baseline.js';
import { BASELINE_PATH, loadConfig, REPOSITORY_ROOT, type FunctionLengthConfig } from './config.js';
import type { Measurement } from './measurement.js';
import { compareWithBaseline, isWithinBaseline, type RatchetResult } from './ratchet.js';
import { formatList, formatRatchet } from './report.js';
import { findViolations } from './scan.js';

export type Mode = 'gate' | 'strict' | 'write-baseline' | 'force-baseline' | 'list';

export interface Arguments {
  readonly mode: Mode;
  readonly root: string;
  readonly baselinePath: string;
}

interface Run {
  readonly arguments: Arguments;
  readonly config: FunctionLengthConfig;
  readonly violations: readonly Measurement[];
  readonly write: (text: string) => void;
}

const SUCCESS = 0;
const FAILURE = 1;
const MODE_FLAGS: ReadonlyArray<readonly [string, Mode]> = [
  ['--strict', 'strict'],
  ['--write-baseline', 'write-baseline'],
  // Exceptional: accepts new or longer functions into the baseline. Explain why in the pull request.
  ['--allow-growth', 'force-baseline'],
  ['--list', 'list'],
];

function optionValue(argv: readonly string[], option: string, fallback: string): string {
  const index = argv.indexOf(option);
  const value = index === -1 ? undefined : argv[index + 1];
  return value ? path.resolve(value) : fallback;
}

export function parseArguments(argv: readonly string[]): Arguments {
  const flag = [...MODE_FLAGS].reverse().find(([option]) => argv.includes(option));
  return {
    mode: flag?.[1] ?? 'gate',
    root: optionValue(argv, '--root', REPOSITORY_ROOT),
    baselinePath: optionValue(argv, '--baseline', BASELINE_PATH),
  };
}

function ratchetOf(run: Run): RatchetResult {
  return compareWithBaseline(run.violations, readBaseline(run.arguments.baselinePath, run.config.limit));
}

function runGate(run: Run): number {
  const result = ratchetOf(run);
  const isPassing = isWithinBaseline(result);
  run.write(
    [...formatRatchet(result, run.config.limit), isPassing ? 'Catraca: OK' : 'Catraca: FALHOU'].join('\n'),
  );
  return isPassing ? SUCCESS : FAILURE;
}

function runStrict(run: Run): number {
  run.write(
    [
      `Funções acima de ${run.config.limit} linhas: ${run.violations.length}`,
      ...formatList(run.violations),
    ].join('\n'),
  );
  return run.violations.length === 0 ? SUCCESS : FAILURE;
}

function saveBaseline(run: Run): number {
  writeBaseline(run.arguments.baselinePath, toBaseline(run.violations, run.config.limit));
  run.write(`Linha de base gravada com ${run.violations.length} funções.`);
  return SUCCESS;
}

function runWriteBaseline(run: Run): number {
  if (!isWithinBaseline(ratchetOf(run))) {
    run.write(
      'A linha de base só encolhe. Corrija as funções da catraca ou use --allow-growth com justificativa.',
    );
    return runGate(run);
  }
  return saveBaseline(run);
}

function runList(run: Run): number {
  run.write(formatList(run.violations).join('\n'));
  return SUCCESS;
}

const MODES: Readonly<Record<Mode, (run: Run) => number>> = {
  gate: runGate,
  strict: runStrict,
  'write-baseline': runWriteBaseline,
  'force-baseline': saveBaseline,
  list: runList,
};

function writeToStandardOutput(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function main(argv: readonly string[], write: (text: string) => void = writeToStandardOutput): number {
  const parsed = parseArguments(argv);
  const config = loadConfig();
  const violations = findViolations(parsed.root, config);
  return MODES[parsed.mode]({ arguments: parsed, config, violations, write });
}

/* v8 ignore next 3 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
