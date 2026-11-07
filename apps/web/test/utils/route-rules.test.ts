import { describe, expect, it } from 'vitest';
import {
  CACHED_PUBLIC_ROUTES,
  PRIVATE_ROUTE_RULE,
  PUBLIC_PAGE_CACHE_SECONDS,
  STATIC_ASSET_CACHE_CONTROL,
  pageRouteRules,
  BROWSER_RENDERED_ROUTE_RULE,
} from '~/utils/route-rules';
import { PRIVATE_ROUTES } from '~/utils/routes';

const isCached = (rule: object | undefined) => Boolean(rule && 'swr' in rule);

describe('pageRouteRules', () => {
  it('caches the public pages for a short time in production', () => {
    const rules = pageRouteRules({ cachePublicPages: true });
    for (const path of CACHED_PUBLIC_ROUTES) expect(rules[path]).toEqual({ swr: PUBLIC_PAGE_CACHE_SECONDS });
    expect(PUBLIC_PAGE_CACHE_SECONDS).toBeLessThanOrEqual(60);
  });

  it('never caches a private page or anything below it', () => {
    const rules = pageRouteRules({ cachePublicPages: true });
    for (const path of PRIVATE_ROUTES) {
      expect(rules[path]).toEqual(PRIVATE_ROUTE_RULE);
      expect(rules[`${path}/**`]).toEqual(PRIVATE_ROUTE_RULE);
    }
    expect(PRIVATE_ROUTE_RULE).toMatchObject({
      ssr: false,
      cache: false,
      headers: { 'cache-control': 'no-store' },
    });
  });

  it('keeps private pages out of the cached list, including the panel under /produtos', () => {
    const cachedPaths: readonly string[] = CACHED_PUBLIC_ROUTES;
    for (const path of PRIVATE_ROUTES) expect(cachedPaths).not.toContain(path);
    expect(pageRouteRules({ cachePublicPages: true })['/produtos/gerenciar/**']).toEqual(PRIVATE_ROUTE_RULE);
  });

  it('leaves pages with tokens and the sign in forms out of the cache', () => {
    const rules = pageRouteRules({ cachePublicPages: true });
    for (const path of [
      '/entrar',
      '/criar-conta',
      '/definir-senha/**',
      '/redefinir-senha/**',
      '/confirmar-email/**',
    ]) {
      expect(isCached(rules[path])).toBe(false);
    }
  });

  it('renders the design gallery in the browser, where Reka UI styles go through the CSSOM', () => {
    const rules = pageRouteRules({ cachePublicPages: true });
    expect(rules['/design']).toEqual(BROWSER_RENDERED_ROUTE_RULE);
    expect(rules['/design/**']).toEqual({ ssr: false });
  });

  it('caches nothing outside production', () => {
    const rules = pageRouteRules({ cachePublicPages: false });
    expect(Object.values(rules).some(isCached)).toBe(false);
    expect(rules['/perfil']).toEqual(PRIVATE_ROUTE_RULE);
  });

  it('lets browsers keep public files but always checks the service worker', () => {
    const rules = pageRouteRules({ cachePublicPages: false });
    expect(rules['/illustrations/**']?.headers).toEqual({ 'cache-control': STATIC_ASSET_CACHE_CONTROL });
    expect(rules['/sw.js']?.headers).toEqual({ 'cache-control': 'no-cache' });
  });
});
