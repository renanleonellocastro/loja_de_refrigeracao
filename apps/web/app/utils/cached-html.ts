/**
 * Cache-Control of server rendered pages: browsers may keep them but must ask again before reuse, and shared
 * caches must not keep them, because each response carries its own CSP nonce.
 */
export const HTML_CACHE_CONTROL = 'private, no-cache';

const POLICY_NONCE = /'nonce-([^']+)'/;

export interface NoncedPage {
  html: string;
  policy: string;
}

/**
 * Swaps the nonce of a page served from the server cache for a fresh one, in the script and style tags and in every
 * directive of the CSP header, so no two responses share a nonce. A page without a nonce in its policy is returned as is.
 */
export function withFreshNonce(page: NoncedPage, nonce: string): NoncedPage {
  const previous = POLICY_NONCE.exec(page.policy)?.[1];
  if (!previous) return page;
  return {
    html: page.html.replaceAll(`nonce="${previous}"`, `nonce="${nonce}"`),
    policy: page.policy.replaceAll(`'nonce-${previous}'`, `'nonce-${nonce}'`),
  };
}

/** Whether a response is a page whose caching headers are set by the server (not a private no-store page). */
export function isCacheablePage(headers: { status: number; type?: string; cacheControl?: string }): boolean {
  if (headers.status >= 400 || !String(headers.type ?? '').includes('text/html')) return false;
  return !String(headers.cacheControl ?? '').includes('no-store');
}
