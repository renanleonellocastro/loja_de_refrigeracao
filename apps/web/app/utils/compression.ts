/** Smallest HTML worth compressing: below this the encoding overhead is larger than the savings. */
export const MIN_COMPRESSED_BYTES = 1024;

export type HtmlEncoding = 'br' | 'gzip';

export interface RenderedResponse {
  body?: unknown;
  statusCode?: number;
  headers?: Record<string, unknown>;
}

/**
 * Chooses the encoding for a server rendered page, or null to send it as is. Brotli wins over gzip.
 *
 * The page rendered for Nuxt's error handler (the internal `/__nuxt_error` request, marked with the
 * `x-nuxt-error` header) is never compressed: the handler reads that body as text and sends it again, so a
 * compressed body would turn the 404 and 500 pages into binary garbage.
 */
export function htmlEncodingFor(
  response: RenderedResponse,
  request: { path: string; acceptEncoding?: string; nuxtError?: boolean },
): HtmlEncoding | null {
  if (request.nuxtError || request.path.startsWith('/__nuxt_error')) return null;
  if (typeof response.body !== 'string' || response.body.length < MIN_COMPRESSED_BYTES) return null;
  const type = String(response.headers?.['content-type'] ?? '');
  if (!type.includes('text/html') || response.headers?.['content-encoding']) return null;
  const accepted = (request.acceptEncoding ?? '')
    .split(',')
    .map((part) => part.trim().split(';'))
    .filter(([, quality]) => quality?.trim() !== 'q=0')
    .map(([name]) => name!.trim().toLowerCase());
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip')) return 'gzip';
  return null;
}
