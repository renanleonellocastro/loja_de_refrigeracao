import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { htmlEncodingFor } from '../../app/utils/compression';

/**
 * Compresses the server rendered HTML (built assets already ship precompressed through
 * `nitro.compressPublicAssets`). Error pages go out uncompressed, see `htmlEncodingFor`. Production should
 * also compress at the reverse proxy (docs/ARQUITETURA.md).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    const encoding = htmlEncodingFor(response, {
      path: event.path,
      acceptEncoding: getRequestHeader(event, 'accept-encoding'),
      nuxtError: Boolean(getRequestHeader(event, 'x-nuxt-error')),
    });
    if (!encoding) return;
    const html = Buffer.from(response.body as string);
    response.body =
      encoding === 'br'
        ? brotliCompressSync(html, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
        : gzipSync(html, { level: 6 });
    response.headers = { ...response.headers, 'content-encoding': encoding, vary: 'Accept-Encoding' };
  });
});
