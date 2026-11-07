/// <reference lib="dom" />
// The loader below runs in the browser, while the server imports this module to write it into the page.

/**
 * Server rendered pages are readable before any script runs: the scripts only hydrate them. So they start
 * downloading only after the page has loaded and painted, and on a slow phone the HTML, the CSS and the hero
 * image get the whole connection and the processor first (RNF-07). Links work as plain links meanwhile.
 */
const MODULE_PRELOAD = /<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"[^>]*>/g;
const ENTRY_SCRIPT = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"[^>]*><\/script>/;

/** Marks the page data of a page rendered on the server; pages that render in the browser have data-ssr="false". */
const SERVER_RENDERED = 'data-ssr="true"';

/*
 * The loader runs inline in place of the entry script, so its functions are serialized with `toString`: they
 * may call one another but nothing else from this module. It waits for the load event, the first contentful
 * paint and the paint of the page's main image, then adds the preloads and the entry module with its own
 * nonce (the CSP trusts them through 'strict-dynamic').
 */

/** Adds a script or preload element with the nonce of the loader. */
function deferredEntryAdd(loader: HTMLScriptElement, tag: string, properties: Record<string, string>): void {
  const security = { nonce: loader.nonce, crossOrigin: '' };
  document.head.append(Object.assign(document.createElement(tag), properties, security));
}

function deferredEntryStart(loader: HTMLScriptElement): void {
  const preloads = (loader.dataset.preload ?? '').split(' ').filter(Boolean);
  for (const href of preloads) deferredEntryAdd(loader, 'link', { rel: 'modulepreload', href });
  deferredEntryAdd(loader, 'script', { type: 'module', src: String(loader.dataset.entry) });
}

/** Calls `done` the first time a performance entry of the type matches; at once if the browser lacks the type. */
function deferredEntryObserve(
  type: string,
  matches: (entry: PerformanceEntry) => boolean,
  done: () => void,
): void {
  if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return done();
  const observer = new PerformanceObserver((list) => {
    if (!list.getEntries().some(matches)) return;
    observer.disconnect();
    done();
  });
  observer.observe({ type, buffered: true });
}

function deferredEntryOnce(callback: () => void): () => void {
  let called = false;
  return () => {
    if (!called) callback();
    called = true;
  };
}

/** The main image of a page is the one with fetchpriority="high". */
function deferredEntryIsHero(entry: PerformanceEntry): boolean {
  return (entry as LargestContentfulPaint).element?.getAttribute('fetchpriority') === 'high';
}

/** Calls `done` once the main image is painted, right after the load event when the page has none, or a second after it. */
function deferredEntryWaitForHero(done: () => void): void {
  const heroWaitMs = 1000;
  const heroPainted = deferredEntryOnce(done);
  deferredEntryObserve('largest-contentful-paint', deferredEntryIsHero, heroPainted);
  const loaded = () => {
    if (!document.querySelector('img[fetchpriority="high"]')) heroPainted();
    setTimeout(heroPainted, heroWaitMs);
  };
  addEventListener('load', loaded, { once: true });
}

export function loadEntryAfterPaint(loader: HTMLScriptElement): void {
  let pending = 3;
  const ready = () => {
    pending -= 1;
    if (pending === 0) setTimeout(() => deferredEntryStart(loader));
  };
  addEventListener('load', ready, { once: true });
  deferredEntryObserve('paint', (entry) => entry.name === 'first-contentful-paint', ready);
  deferredEntryWaitForHero(ready);
}

const LOADER_FUNCTIONS = [
  deferredEntryAdd,
  deferredEntryStart,
  deferredEntryObserve,
  deferredEntryOnce,
  deferredEntryIsHero,
  deferredEntryWaitForHero,
  loadEntryAfterPaint,
];

/** Source of the inline loader, see `loadEntryAfterPaint`. */
export const DEFERRED_ENTRY_LOADER = `(function(){${LOADER_FUNCTIONS.map(String).join('\n')}\nloadEntryAfterPaint(document.currentScript)})()`;

export interface PageHtml {
  head: string[];
  bodyAppend: string[];
}

function preloadedScripts(head: string[]): string[] {
  return head.flatMap((fragment) =>
    [...fragment.matchAll(MODULE_PRELOAD)].map((match) => match[1] as string),
  );
}

function entryLoader(entry: string, preloads: string[]): string {
  const others = preloads.filter((href) => href !== entry).join(' ');
  return `<script data-entry="${entry}" data-preload="${others}">${DEFERRED_ENTRY_LOADER}</script>`;
}

/**
 * Swaps the entry module script and the script preloads of a server rendered page for the deferred loader.
 * Pages rendered in the browser (signed in area) keep their scripts: they have nothing to show without them.
 */
export function deferPageScripts(html: PageHtml): string[] {
  const entry = html.head.map((fragment) => ENTRY_SCRIPT.exec(fragment)?.[1]).find(Boolean);
  if (!entry || !html.bodyAppend.some((fragment) => fragment.includes(SERVER_RENDERED))) return html.head;
  const loader = entryLoader(entry, preloadedScripts(html.head));
  return html.head.map((fragment) => fragment.replace(MODULE_PRELOAD, '').replace(ENTRY_SCRIPT, loader));
}
