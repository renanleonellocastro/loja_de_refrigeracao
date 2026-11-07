import { beforeEach, describe, expect, it, vi } from 'vitest';
import fonts from '~/plugins/fonts.client';
import { FONTS_READY, enableWebFontsAfterLoad } from '~/utils/fonts';

function fakePage(readyState: DocumentReadyState) {
  const listeners: Record<string, () => void> = {};
  const page = {
    document: { readyState },
    addEventListener: vi.fn((name: string, listener: () => void) => (listeners[name] = listener)),
  };
  return { page: page as unknown as Window, listeners };
}

describe('enableWebFontsAfterLoad', () => {
  beforeEach(() => document.documentElement.removeAttribute('data-fonts'));

  it('waits for the load event before turning the web fonts on', () => {
    const { page, listeners } = fakePage('interactive');
    enableWebFontsAfterLoad(page);
    expect(document.documentElement.dataset.fonts).toBeUndefined();
    listeners.load!();
    expect(document.documentElement.dataset.fonts).toBe(FONTS_READY);
  });

  it('turns the web fonts on at once when the page already loaded', () => {
    const { page } = fakePage('complete');
    enableWebFontsAfterLoad(page);
    expect(document.documentElement.dataset.fonts).toBe(FONTS_READY);
  });

  it('runs from the client plugin', async () => {
    await (fonts as unknown as () => unknown)();
    expect(document.documentElement.dataset.fonts).toBe(FONTS_READY);
  });
});
