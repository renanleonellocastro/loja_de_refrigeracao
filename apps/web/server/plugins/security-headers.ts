import { randomBytes } from 'node:crypto';
import { HSTS, SECURITY_HEADERS, contentSecurityPolicy, withNonce } from '../../app/utils/security';

/**
 * Security headers on every response and a nonce based CSP on every rendered page. The development server
 * keeps no CSP and no HSTS, because Vite injects inline scripts and serves plain HTTP.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    setResponseHeaders(event, SECURITY_HEADERS);
    if (!import.meta.dev) setResponseHeader(event, 'strict-transport-security', HSTS);
  });

  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (import.meta.dev) return;
    const nonce = randomBytes(16).toString('base64');
    for (const part of ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const) {
      html[part] = html[part].map((fragment) => withNonce(fragment, nonce));
    }
    const { apiBase } = useRuntimeConfig(event).public;
    setResponseHeader(event, 'content-security-policy', contentSecurityPolicy(nonce, apiBase));
  });

  // Nothing about the stack is announced (ASVS 14.3.3).
  nitroApp.hooks.hook('beforeResponse', (event) => {
    removeResponseHeader(event, 'x-powered-by');
  });
});
