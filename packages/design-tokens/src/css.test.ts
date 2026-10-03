import { describe, expect, it } from 'vitest';
import { buildCss } from './css.js';
import { dark, light } from './tokens.js';

describe('buildCss', () => {
  const css = buildCss();

  it('exposes the brand palette to Tailwind', () => {
    expect(css).toContain('--color-castro-700: #184E86;');
    expect(css).toContain('--color-white: #FFFFFF;');
    expect(css).toContain("--font-display: 'Archivo'");
    expect(css).toContain('--breakpoint-md: 48rem;');
  });

  it('maps every semantic color to a CSS variable', () => {
    for (const name of Object.keys(light)) {
      expect(css).toContain(`--color-${name}: var(--rc-${name});`);
    }
  });

  it('defines light defaults, a system dark mode and a forced dark mode', () => {
    expect(css).toContain(`:root {\n  --rc-bg: ${light.bg};`);
    expect(css).toContain(':root:not([data-theme="light"])');
    expect(css).toContain(`:root[data-theme="dark"] {\n  --rc-bg: ${dark.bg};`);
  });

  it('lets any element force a theme for its subtree', () => {
    expect(css).toContain(`:where(:root) [data-theme="dark"] {\n  --rc-bg: ${dark.bg};`);
    expect(css).toContain(`:where(:root) [data-theme="light"] {\n  --rc-bg: ${light.bg};`);
  });
});
