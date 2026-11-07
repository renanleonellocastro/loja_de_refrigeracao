import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFERRED_ENTRY_LOADER, deferPageScripts, loadEntryAfterPaint } from '~/utils/resource-hints';

const ENTRY = '<script type="module" src="/_nuxt/entry.js" crossorigin></script>';
const PRELOADS =
  '<link rel="modulepreload" as="script" crossorigin href="/_nuxt/entry.js">' +
  '<link rel="modulepreload" as="script" crossorigin href="/_nuxt/vue.js">';
const SSR_DATA = '<script type="application/json" data-ssr="true" id="__NUXT_DATA__">[]</script>';

describe('deferPageScripts', () => {
  it('swaps the entry script and its preloads for the loader on server rendered pages', () => {
    const head = deferPageScripts({
      head: [`${PRELOADS}<link rel="preload" as="image" href="/x.svg">`, `<meta charset="utf-8">${ENTRY}`],
      bodyAppend: [SSR_DATA],
    });
    expect(head[0]).toBe('<link rel="preload" as="image" href="/x.svg">');
    expect(head[1]).toBe(
      `<meta charset="utf-8"><script data-entry="/_nuxt/entry.js" data-preload="/_nuxt/vue.js">${DEFERRED_ENTRY_LOADER}</script>`,
    );
  });

  it('keeps the scripts of pages rendered in the browser and of pages without an entry', () => {
    const spa = { head: [PRELOADS + ENTRY], bodyAppend: ['<script data-ssr="false"></script>'] };
    expect(deferPageScripts(spa)).toBe(spa.head);
    const plain = { head: ['<title>x</title>'], bodyAppend: [SSR_DATA] };
    expect(deferPageScripts(plain)).toBe(plain.head);
  });

  it('serializes a loader that needs nothing from its module', () => {
    const listen = vi.fn();
    const run = new Function('document', 'addEventListener', 'PerformanceObserver', DEFERRED_ENTRY_LOADER);
    run({ currentScript: document.createElement('script') }, listen, { supportedEntryTypes: [] });
    expect(listen.mock.calls.map(([type]) => type)).toEqual(['load', 'load']);
  });
});

type ObserverCallback = (list: { getEntries: () => PerformanceEntry[] }) => void;

describe('loadEntryAfterPaint', () => {
  const observers: { type: string; callback: ObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  let supported: string[] | undefined;

  class FakeObserver {
    static get supportedEntryTypes() {
      return supported;
    }
    disconnect = vi.fn();
    constructor(private readonly callback: ObserverCallback) {}
    observe({ type }: { type: string }) {
      observers.push({ type, callback: this.callback, disconnect: this.disconnect });
    }
  }

  function loader(preload?: string): HTMLScriptElement {
    const script = document.createElement('script');
    script.nonce = 'abc';
    if (preload !== undefined) script.dataset.preload = preload;
    script.dataset.entry = '/_nuxt/entry.js';
    return script;
  }

  function emit(type: string, entries: object[]) {
    for (const observer of observers.filter((item) => item.type === type)) {
      observer.callback({ getEntries: () => entries as PerformanceEntry[] });
    }
  }

  const heroImage = () => {
    const image = document.createElement('img');
    image.setAttribute('fetchpriority', 'high');
    return image;
  };
  const added = () => [...document.head.querySelectorAll('link[rel="modulepreload"], script[type="module"]')];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('PerformanceObserver', FakeObserver);
    supported = ['paint', 'largest-contentful-paint'];
    observers.length = 0;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('adds the preloads and the entry once the page loaded and its main image painted', () => {
    const hero = heroImage();
    document.body.append(hero);
    loadEntryAfterPaint(loader('/_nuxt/a.js /_nuxt/b.js'));
    window.dispatchEvent(new Event('load'));
    emit('paint', [{ name: 'first-paint' }]);
    emit('paint', [{ name: 'first-contentful-paint' }]);
    emit('largest-contentful-paint', [{ element: document.createElement('h1') }]);
    vi.runAllTicks();
    expect(added()).toHaveLength(0);
    emit('largest-contentful-paint', [{ element: hero }]);
    vi.advanceTimersByTime(0);
    expect(added().map((element) => element.getAttribute('href') ?? element.getAttribute('src'))).toEqual([
      '/_nuxt/a.js',
      '/_nuxt/b.js',
      '/_nuxt/entry.js',
    ]);
    const entry = added()[2] as HTMLScriptElement;
    expect([entry.nonce, entry.crossOrigin, entry.type]).toEqual(['abc', '', 'module']);
    expect(observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(added()).toHaveLength(3);
  });

  it('stops waiting for the main image a second after the load event', () => {
    document.body.append(heroImage());
    loadEntryAfterPaint(loader());
    emit('paint', [{ name: 'first-contentful-paint' }]);
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(999);
    expect(added()).toHaveLength(0);
    vi.advanceTimersByTime(1);
    vi.runAllTimers();
    expect(added()).toHaveLength(1);
  });

  it('goes by the load event alone without paint timing or a main image', () => {
    supported = undefined;
    loadEntryAfterPaint(loader(''));
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(0);
    expect(added()).toHaveLength(1);
    expect(observers).toHaveLength(0);
  });
});
