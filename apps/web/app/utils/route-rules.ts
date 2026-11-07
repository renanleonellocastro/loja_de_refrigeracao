import { PRIVATE_ROUTES } from './routes';

/**
 * Seconds a public page is served from the server cache before it renders again in the background. Short,
 * so a product, price or store setting edited in the panel shows on the site within a minute.
 */
export const PUBLIC_PAGE_CACHE_SECONDS = 60;

/**
 * Public pages cached on the server. Their HTML is the same for every visitor: the server render never sees
 * the session (the access token lives in browser memory) and cached renders get no cookies. Pages with a
 * token in the address, the sign in forms and the design gallery stay out.
 */
export const CACHED_PUBLIC_ROUTES = [
  '/',
  '/produtos',
  '/produtos/**',
  '/servicos',
  '/sobre',
  '/contato',
  '/privacidade',
] as const;

export interface PageRouteRule {
  ssr?: false;
  swr?: number;
  cache?: false;
  headers?: Record<string, string>;
}

/** Private pages render in the browser and are never stored, on the server or anywhere on the way. */
export const PRIVATE_ROUTE_RULE: PageRouteRule = {
  ssr: false,
  cache: false,
  headers: { 'cache-control': 'no-store' },
};

/**
 * Files in public/ keep their name when they change, so browsers keep them a day and refresh them in the
 * background for a week. The service worker must always be checked, or an update would never arrive.
 */
export const STATIC_ASSET_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';
const STATIC_ASSET_PATHS = [
  '/illustrations/**',
  '/brand/**',
  '/favicon.svg',
  '/favicon-32.png',
  '/apple-touch-icon.png',
];

function staticAssetRules(): [string, PageRouteRule][] {
  const shared: PageRouteRule = { headers: { 'cache-control': STATIC_ASSET_CACHE_CONTROL } };
  return [
    ...STATIC_ASSET_PATHS.map((path): [string, PageRouteRule] => [path, shared]),
    ['/sw.js', { headers: { 'cache-control': 'no-cache' } }],
  ];
}

function privateRouteRules(): [string, PageRouteRule][] {
  return PRIVATE_ROUTES.flatMap((path) => [
    [path, PRIVATE_ROUTE_RULE],
    [`${path}/**`, PRIVATE_ROUTE_RULE],
  ]);
}

/**
 * The design gallery renders in the browser: on the server the Reka UI components it shows (tabs, switch,
 * checkbox) write style attributes, which the CSP blocks. In the browser Vue sets them through the CSSOM.
 */
export const BROWSER_RENDERED_ROUTE_RULE: PageRouteRule = { ssr: false };
const BROWSER_RENDERED_PATHS = ['/design', '/design/**'];

function browserRenderedRules(): [string, PageRouteRule][] {
  return BROWSER_RENDERED_PATHS.map((path) => [path, BROWSER_RENDERED_ROUTE_RULE]);
}

function publicCacheRules(): [string, PageRouteRule][] {
  return CACHED_PUBLIC_ROUTES.map((path) => [path, { swr: PUBLIC_PAGE_CACHE_SECONDS }]);
}

/**
 * Nitro route rules for the pages and the files in public/. The server cache is on in production builds only (nuxt.config.ts), so
 * the development server and the E2E tests always render fresh. Private rules come last and are more
 * specific, so /produtos/gerenciar stays uncached under /produtos/**.
 */
export function pageRouteRules(options: { cachePublicPages: boolean }): Record<string, PageRouteRule> {
  const cached = options.cachePublicPages ? publicCacheRules() : [];
  return Object.fromEntries([
    ...staticAssetRules(),
    ...cached,
    ...browserRenderedRules(),
    ...privateRouteRules(),
  ]);
}
