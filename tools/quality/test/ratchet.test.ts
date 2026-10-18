import { describe, expect, it } from 'vitest';
import { toBaseline } from '../src/baseline.js';
import { compareWithBaseline, isWithinBaseline } from '../src/ratchet.js';

const violation = (name: string, length: number) => ({ path: 'a.ts', line: 1, name, length });
const baselineOf = (...violations: ReturnType<typeof violation>[]) => toBaseline(violations, 12);

describe('compareWithBaseline', () => {
  it('passes when nothing changed', () => {
    const result = compareWithBaseline([violation('a', 20)], baselineOf(violation('a', 20)));

    expect(isWithinBaseline(result)).toBe(true);
    expect(result.shrinkable).toBe(0);
  });

  it('fails on a function that is not in the baseline', () => {
    const result = compareWithBaseline(
      [violation('a', 20), violation('b', 13)],
      baselineOf(violation('a', 20)),
    );

    expect(result.unlisted.map(({ name }) => name)).toEqual(['b']);
    expect(isWithinBaseline(result)).toBe(false);
  });

  it('fails on a baselined function that grew', () => {
    const result = compareWithBaseline([violation('a', 21)], baselineOf(violation('a', 20)));

    expect(result.grown).toEqual([{ measurement: violation('a', 21), baselineLength: 20 }]);
    expect(isWithinBaseline(result)).toBe(false);
  });

  it('counts removed and shorter functions as room to shrink', () => {
    const result = compareWithBaseline(
      [violation('a', 15)],
      baselineOf(violation('a', 20), violation('b', 30)),
    );

    expect(result.shrinkable).toBe(2);
    expect(isWithinBaseline(result)).toBe(true);
  });

  it('pairs functions sharing a name longest with longest', () => {
    const baseline = baselineOf(violation('anonymous', 40), violation('anonymous', 15));
    const result = compareWithBaseline([violation('anonymous', 15), violation('anonymous', 39)], baseline);

    expect(result.grown).toEqual([]);
    expect(result.shrinkable).toBe(1);
  });

  it('fails when the total passes the baseline total', () => {
    const result = compareWithBaseline([violation('a', 20)], {
      limit: 12,
      total: 0,
      functions: baselineOf(violation('a', 20)).functions,
    });

    expect(isWithinBaseline(result)).toBe(false);
  });
});
