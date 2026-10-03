import { describe, expect, it, vi } from 'vitest';
import { errorKindFor } from '~/utils/errors';
import { inlineLogoSvg } from '~/utils/logo';
import { pageSlots } from '~/utils/pagination';
import { passwordStrength } from '~/utils/password';
import { STATUS_META, statusMeta } from '~/utils/status';
import { initialsOf } from '~/utils/text';
import {
  THEME_BOOT_SCRIPT,
  applyThemePreference,
  isThemePreference,
  readThemePreference,
  writeThemePreference,
} from '~/utils/theme';
import { controlFrameClasses } from '~/utils/ui';

describe('initialsOf', () => {
  it('uses first and last names', () => {
    expect(initialsOf('Eduardo de Castro')).toBe('EC');
    expect(initialsOf('  joão ')).toBe('J');
    expect(initialsOf('')).toBe('?');
  });
});

describe('pageSlots', () => {
  it('lists every page when few', () => {
    expect(pageSlots(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageSlots(1, 0)).toEqual([]);
  });

  it('adds gaps around the current page', () => {
    expect(pageSlots(6, 20)).toEqual([1, 'gap', 5, 6, 7, 'gap', 20]);
    expect(pageSlots(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageSlots(20, 20)).toEqual([1, 'gap', 19, 20]);
    expect(pageSlots(3, 20)).toEqual([1, 2, 3, 4, 'gap', 20]);
  });
});

describe('passwordStrength', () => {
  it('grows with length and variety', () => {
    expect(passwordStrength('abc')).toBe(0);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefG1')).toBe(2);
    expect(passwordStrength('abcdefG1!')).toBe(3);
    expect(passwordStrength('abcdefG1!xyz')).toBe(4);
  });
});

describe('statusMeta', () => {
  it('has a label, tone and icon for every status', () => {
    for (const table of Object.values(STATUS_META)) {
      for (const meta of Object.values(table)) {
        expect(meta.label).not.toBe('');
        expect(meta.icon).toBeDefined();
      }
    }
    expect(statusMeta('order', 'PICKED_UP').label).toBe('Retirado');
    expect(statusMeta('serviceRequest', 'AWAITING_CUSTOMER').label).toBe('Em conversa');
    expect(statusMeta('quote', 'EXPIRED').label).toBe('Vencido');
  });

  it('falls back to a neutral badge for unknown codes', () => {
    expect(statusMeta('quote', 'NEW_THING')).toMatchObject({ label: 'NEW_THING', tone: 'neutral' });
  });
});

describe('errorKindFor', () => {
  it('maps status codes and the connection', () => {
    expect(errorKindFor(404, false)).toBe('offline');
    expect(errorKindFor(404, true)).toBe('not-found');
    expect(errorKindFor(403, true)).toBe('forbidden');
    expect(errorKindFor(500, true)).toBe('server');
    expect(errorKindFor(undefined, true)).toBe('server');
  });
});

describe('inlineLogoSvg', () => {
  const raw =
    '<svg xmlns="x" viewBox="0 0 1 1" role="img" aria-label="Logo"><title>Logo</title><g fill="currentColor"><path d="M0"/></g></svg>';

  it('moves the accessible name to the wrapper', () => {
    const svg = inlineLogoSvg(raw);
    expect(svg).not.toContain('<title>');
    expect(svg).not.toContain('role="img"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('fill="currentColor"');
  });

  it('adds the silver relief with unique ids', () => {
    const svg = inlineLogoSvg(raw, 'abc');
    expect(svg).toContain('id="abc-silver"');
    expect(svg).toContain('fill="url(#abc-silver)" filter="url(#abc-relief)"');
  });
});

describe('theme preference', () => {
  it('recognizes valid values', () => {
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('blue')).toBe(false);
  });

  it('reads, falling back to system on bad values or blocked storage', () => {
    expect(readThemePreference(() => ({ getItem: () => 'dark' }))).toBe('dark');
    expect(readThemePreference(() => ({ getItem: () => 'neon' }))).toBe('system');
    expect(
      readThemePreference(() => {
        throw new Error('blocked');
      }),
    ).toBe('system');
  });

  it('writes and ignores blocked storage', () => {
    const setItem = vi.fn();
    writeThemePreference(() => ({ setItem }), 'light');
    expect(setItem).toHaveBeenCalledWith('rc-theme', 'light');
    expect(() =>
      writeThemePreference(() => {
        throw new Error('blocked');
      }, 'dark'),
    ).not.toThrow();
  });

  it('applies to the root element', () => {
    const root = document.createElement('html');
    applyThemePreference(root, 'dark');
    expect(root.dataset.theme).toBe('dark');
    applyThemePreference(root, 'system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('boot script sets a saved theme before paint', () => {
    localStorage.setItem('rc-theme', 'dark');
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe('dark');
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });
});

describe('controlFrameClasses', () => {
  it('marks errors and disabled controls', () => {
    expect(controlFrameClasses(true).join(' ')).toContain('border-danger');
    expect(controlFrameClasses(false, true).join(' ')).toContain('cursor-not-allowed');
  });
});
