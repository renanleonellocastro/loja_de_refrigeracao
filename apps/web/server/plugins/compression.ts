import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { htmlEncodingFor, type HtmlEncoding, type RenderedResponse } from '../../app/utils/compression';

/** Event of the request being answered (h3 is auto imported by Nitro as a value only). */
type RequestEvent = InstanceType<typeof H3Event>;

const BROTLI_QUALITY = 5;
const GZIP_LEVEL = 6;

const COMPRESSORS: Readonly<Record<HtmlEncoding, (html: Buffer) => Buffer>> = {
  br: (html) => brotliCompressSync(html, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } }),
  gzip: (html) => gzipSync(html, { level: GZIP_LEVEL }),
};

function encodingFor(response: RenderedResponse, event: RequestEvent): HtmlEncoding | null {
  return htmlEncodingFor(response, {
    path: event.path,
    acceptEncoding: getRequestHeader(event, 'accept-encoding'),
    nuxtError: Boolean(getRequestHeader(event, 'x-nuxt-error')),
  });
}

function compressHtml(response: RenderedResponse, event: RequestEvent): void {
  const encoding = encodingFor(response, event);
  if (!encoding) return;
  response.body = COMPRESSORS[encoding](Buffer.from(response.body as string));
  response.headers = { ...response.headers, 'content-encoding': encoding, vary: 'Accept-Encoding' };
}

/**
 * Compresses the server rendered HTML (built assets already ship precompressed through
 * `nitro.compressPublicAssets`). Error pages go out uncompressed, see `htmlEncodingFor`. Production should
 * also compress at the reverse proxy (docs/ARQUITETURA.md).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response, { event }) => compressHtml(response, event));
});
