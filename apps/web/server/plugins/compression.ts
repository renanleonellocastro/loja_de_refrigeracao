import { htmlEncodingFor, type HtmlEncoding, type RenderedResponse } from '../../app/utils/compression';
import { compressHtml } from '../utils/html-compression';

/** Event of the request being answered (h3 is auto imported by Nitro as a value only). */
type RequestEvent = InstanceType<typeof H3Event>;

function encodingFor(response: RenderedResponse, event: RequestEvent): HtmlEncoding | null {
  return htmlEncodingFor(response, {
    path: event.path,
    acceptEncoding: getRequestHeader(event, 'accept-encoding'),
    nuxtError: Boolean(getRequestHeader(event, 'x-nuxt-error')),
  });
}

function compressRendered(response: RenderedResponse, event: RequestEvent): void {
  const encoding = encodingFor(response, event);
  if (!encoding) return;
  response.body = compressHtml(response.body as string, encoding);
  response.headers = { ...response.headers, 'content-encoding': encoding, vary: 'Accept-Encoding' };
}

/**
 * Compresses the server rendered HTML (built assets already ship precompressed through
 * `nitro.compressPublicAssets`; pages served from the server cache are compressed in cached-pages.ts).
 * Error pages go out uncompressed, see `htmlEncodingFor`. Production should also compress at the reverse
 * proxy (docs/ARQUITETURA.md).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response, { event }) => compressRendered(response, event));
});
