import { randomBytes } from 'node:crypto';
import { HTML_CACHE_CONTROL, isCacheablePage, withFreshNonce } from '../../app/utils/cached-html';
import { htmlEncodingFor } from '../../app/utils/compression';
import { compressHtml } from '../utils/html-compression';

/** Event of the request being answered (h3 is auto imported by Nitro as a value only). */
type RequestEvent = InstanceType<typeof H3Event>;
type OutgoingResponse = { body?: unknown };

const NONCE_BYTES = 16;

function renewNonce(event: RequestEvent, response: OutgoingResponse): void {
  const policy = getResponseHeader(event, 'content-security-policy');
  if (typeof response.body !== 'string' || typeof policy !== 'string') return;
  const fresh = withFreshNonce({ html: response.body, policy }, randomBytes(NONCE_BYTES).toString('base64'));
  response.body = fresh.html;
  setResponseHeader(event, 'content-security-policy', fresh.policy);
}

function compressCached(event: RequestEvent, response: OutgoingResponse): void {
  const headers = { 'content-type': getResponseHeader(event, 'content-type') };
  const acceptEncoding = getRequestHeader(event, 'accept-encoding');
  const encoding = htmlEncodingFor({ body: response.body, headers }, { path: event.path, acceptEncoding });
  if (!encoding) return;
  response.body = compressHtml(response.body as string, encoding);
  setResponseHeaders(event, { 'content-encoding': encoding, vary: 'Accept-Encoding' });
}

/** No validators: a 304 would pair the stored page with the new CSP header and its different nonce. */
function setPageCaching(event: RequestEvent): void {
  removeResponseHeader(event, 'etag');
  removeResponseHeader(event, 'last-modified');
  setResponseHeader(event, 'cache-control', HTML_CACHE_CONTROL);
}

function finishPage(event: RequestEvent, response: OutgoingResponse): void {
  const status = getResponseStatus(event);
  const type = String(getResponseHeader(event, 'content-type') ?? '');
  const cacheControl = String(getResponseHeader(event, 'cache-control') ?? '');
  if (!isCacheablePage({ status, type, cacheControl })) return;
  renewNonce(event, response);
  compressCached(event, response);
  setPageCaching(event);
}

/**
 * Pages served from the server cache (route rules with swr) come back as the stored text with the nonce and
 * headers of the render that filled the cache. Each response gets a fresh nonce, is compressed for this
 * client (the cached render never sees Accept-Encoding) and leaves without validators or shared caching.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', finishPage);
});
