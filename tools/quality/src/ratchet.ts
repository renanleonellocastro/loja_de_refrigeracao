import type { Baseline, BaselineEntry } from './baseline.js';
import type { Measurement } from './measurement.js';

export interface GrownFunction {
  readonly measurement: Measurement;
  readonly baselineLength: number;
}

export interface RatchetResult {
  readonly violations: readonly Measurement[];
  readonly unlisted: readonly Measurement[];
  readonly grown: readonly GrownFunction[];
  /** Baseline entries that are gone or shorter: the baseline can shrink by this many steps. */
  readonly shrinkable: number;
  readonly baselineTotal: number;
}

type Keyed = { readonly path: string; readonly name: string; readonly length: number };

function keyOf(item: Keyed): string {
  return `${item.path}\0${item.name}`;
}

function groupByKey<Item extends Keyed>(items: readonly Item[]): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item]);
  }
  for (const group of groups.values()) {
    group.sort((first, second) => second.length - first.length);
  }
  return groups;
}

interface GroupOutcome {
  unlisted: Measurement[];
  grown: GrownFunction[];
  shrinkable: number;
}

// Functions sharing a path and name (anonymous callbacks, overloads) pair up longest with longest.
function compareGroup(current: readonly Measurement[], listed: readonly BaselineEntry[]): GroupOutcome {
  const outcome: GroupOutcome = { unlisted: current.slice(listed.length), grown: [], shrinkable: 0 };
  listed.forEach((entry, index) => {
    const measurement = current[index];
    if (measurement && measurement.length > entry.length) {
      outcome.grown.push({ measurement, baselineLength: entry.length });
    }
    outcome.shrinkable += !measurement || measurement.length < entry.length ? 1 : 0;
  });
  return outcome;
}

function mergeOutcomes(outcomes: readonly GroupOutcome[]): GroupOutcome {
  return {
    unlisted: outcomes.flatMap((outcome) => outcome.unlisted),
    grown: outcomes.flatMap((outcome) => outcome.grown),
    shrinkable: outcomes.reduce((sum, outcome) => sum + outcome.shrinkable, 0),
  };
}

export function compareWithBaseline(violations: readonly Measurement[], baseline: Baseline): RatchetResult {
  const current = groupByKey(violations);
  const listed = groupByKey(baseline.functions);
  const keys = new Set([...current.keys(), ...listed.keys()]);
  const outcomes = [...keys].map((key) => compareGroup(current.get(key) ?? [], listed.get(key) ?? []));
  return { violations, ...mergeOutcomes(outcomes), baselineTotal: baseline.total };
}

export function isWithinBaseline(result: RatchetResult): boolean {
  const isTotalWithin = result.violations.length <= result.baselineTotal;
  return result.unlisted.length === 0 && result.grown.length === 0 && isTotalWithin;
}
