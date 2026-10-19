import { randomBytes } from 'node:crypto';
import type { NuxtRenderHTMLContext } from 'nuxt/app';
import { HSTS, SECURITY_HEADERS, contentSecurityPolicy, withNonce } from '../../app/utils/security';

/** Event of the request being answered (h3 is auto imported by Nitro as a value only). */
type RequestEvent = InstanceType<typeof H3Event>;

const NONCE_BYTES = 16;
const HTML_PARTS = ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const;

function sendSecurityHeaders(event: RequestEvent): void {
  setResponseHeaders(event, SECURITY_HEADERS);
  if (!import.meta.dev) setResponseHeader(event, 'strict-transport-security', HSTS);
}

function addNonceToScripts(html: NuxtRenderHTMLContext, nonce: string): void {
  for (const part of HTML_PARTS) {
    html[part] = html[part].map((fragment) => withNonce(fragment, nonce));
  }
}

function applyContentSecurityPolicy(html: NuxtRenderHTMLContext, event: RequestEvent): void {
  if (import.meta.dev) return;
  const nonce = randomBytes(NONCE_BYTES).toString('base64');
  addNonceToScripts(html, nonce);
  const { apiBase } = useRuntimeConfig(event).public;
  setResponseHeader(event, 'content-security-policy', contentSecurityPolicy(nonce, apiBase));
}

/** Nothing about the stack is announced (ASVS 14.3.3). */
function hideStack(event: RequestEvent): void {
  removeResponseHeader(event, 'x-powered-by');
}

/**
 * Security headers on every response and a nonce based CSP on every rendered page. The development server
 * keeps no CSP and no HSTS, because Vite injects inline scripts and serves plain HTTP.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', sendSecurityHeaders);
  nitroApp.hooks.hook('render:html', (html, { event }) => applyContentSecurityPolicy(html, event));
  nitroApp.hooks.hook('beforeResponse', hideStack);
});
