import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Measurement } from './measurement.js';

export interface BaselineEntry {
  readonly path: string;
  readonly name: string;
  readonly length: number;
}

export interface Baseline {
  readonly limit: number;
  readonly total: number;
  readonly functions: readonly BaselineEntry[];
}

const JSON_INDENT = 2;

function compareEntries(first: BaselineEntry, second: BaselineEntry): number {
  return (
    first.path.localeCompare(second.path) ||
    first.name.localeCompare(second.name) ||
    second.length - first.length
  );
}

export function toBaseline(violations: readonly Measurement[], limit: number): Baseline {
  const functions = violations.map(({ path, name, length }) => ({ path, name, length })).sort(compareEntries);
  return { limit, total: functions.length, functions };
}

export function readBaseline(baselinePath: string, limit: number): Baseline {
  if (!existsSync(baselinePath)) {
    return toBaseline([], limit);
  }
  return JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline;
}

export function writeBaseline(baselinePath: string, baseline: Baseline): void {
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, JSON_INDENT)}\n`);
}
