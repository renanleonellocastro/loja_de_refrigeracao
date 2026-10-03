import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex } from './contrast.js';
import { contrastPairs, dark, light } from './tokens.js';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#184E86', '#FFFFFF')).toBe(contrastRatio('#FFFFFF', '#184E86'));
  });

  it('rejects malformed colors', () => {
    expect(() => parseHex('blue')).toThrowError('Invalid hex color: blue');
    expect(() => parseHex('#fff')).toThrowError();
  });
});

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, colors) => {
  it.each(contrastPairs)('$fg on $bg reaches $min:1', ({ fg, bg, min }) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });
});
