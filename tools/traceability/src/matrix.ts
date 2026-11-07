import type { Requirement } from './requirements.js';
import type { TaggedTest } from './tests.js';

export interface MatrixRow {
  readonly requirement: Requirement;
  readonly tests: readonly TaggedTest[];
}

export interface Matrix {
  readonly rows: readonly MatrixRow[];
  readonly uncovered: readonly string[];
  readonly unknownTags: readonly string[];
}

function rowOf(requirement: Requirement, tests: readonly TaggedTest[]): MatrixRow {
  return { requirement, tests: tests.filter((test) => test.requirements.includes(requirement.id)) };
}

/** Each requirement with the tests that name it, plus the gaps in both directions. */
export function buildMatrix(requirements: readonly Requirement[], tests: readonly TaggedTest[]): Matrix {
  const rows = requirements.map((requirement) => rowOf(requirement, tests));
  const known = new Set(requirements.map((requirement) => requirement.id));
  const tagged = new Set(tests.flatMap((test) => test.requirements));
  return {
    rows,
    uncovered: rows.filter((row) => row.tests.length === 0).map((row) => row.requirement.id),
    unknownTags: [...tagged].filter((id) => !known.has(id)).sort(),
  };
}
