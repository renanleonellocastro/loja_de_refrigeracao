import type { Measurement } from './measurement.js';
import type { GrownFunction, RatchetResult } from './ratchet.js';

const BASELINE_COMMAND = 'make function-length-baseline';

export function formatMeasurement(measurement: Measurement): string {
  return `${measurement.path}:${measurement.line} ${measurement.name} ${measurement.length}`;
}

function compareMeasurements(first: Measurement, second: Measurement): number {
  return second.length - first.length || first.path.localeCompare(second.path) || first.line - second.line;
}

export function formatList(violations: readonly Measurement[]): string[] {
  return [...violations].sort(compareMeasurements).map((violation) => `  ${formatMeasurement(violation)}`);
}

function formatGrown(grown: GrownFunction): string {
  return `  ${formatMeasurement(grown.measurement)} (era ${grown.baselineLength})`;
}

function formatShrinkHint(result: RatchetResult): string[] {
  if (result.shrinkable === 0) {
    return [];
  }
  return [`A linha de base pode encolher em ${result.shrinkable} entradas: rode ${BASELINE_COMMAND}.`];
}

export function formatRatchet(result: RatchetResult, limit: number): string[] {
  return [
    `Funções com corpo acima de ${limit} linhas: ${result.violations.length} (linha de base: ${result.baselineTotal})`,
    `Novas acima do limite ou fora da linha de base: ${result.unlisted.length}`,
    ...formatList(result.unlisted),
    `Cresceram desde a linha de base: ${result.grown.length}`,
    ...result.grown.map(formatGrown),
    ...formatShrinkHint(result),
  ];
}
