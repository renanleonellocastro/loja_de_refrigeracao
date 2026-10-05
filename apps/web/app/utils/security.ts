// Security headers for the pages the site renders (docs/SEGURANCA.md, section 4).

/** Sent with every response of the site. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  // Photo uploads use the file input (capture opens the native camera), so no feature needs the browser APIs.
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Two years, as the browsers' preload lists ask; only sent by the production build. */
export const HSTS = 'max-age=63072000; includeSubDomains';

/**
 * Scripts run only from this origin or with the per response nonce ('strict-dynamic' lets the Nuxt entry load
 * its chunks), so there is no 'unsafe-inline' for scripts. Inline styles stay allowed for Vue and the fonts.
 */
export function contentSecurityPolicy(nonce: string, apiBase: string): string {
  const api = new URL(apiBase).origin;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${api}`,
    "font-src 'self' data:",
    `connect-src 'self' ${api}`,
    'frame-src https://www.google.com',
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Adds the nonce to every script tag of a rendered HTML fragment that does not have one yet. */
export function withNonce(fragment: string, nonce: string): string {
  return fragment.replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
}
