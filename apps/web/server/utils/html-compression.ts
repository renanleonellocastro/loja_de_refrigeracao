import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import type { HtmlEncoding } from '../../app/utils/compression';

const BROTLI_QUALITY = 5;
const GZIP_LEVEL = 6;

const COMPRESSORS: Readonly<Record<HtmlEncoding, (html: Buffer) => Buffer>> = {
  br: (html) => brotliCompressSync(html, { params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } }),
  gzip: (html) => gzipSync(html, { level: GZIP_LEVEL }),
};

/** Compresses a rendered page with the chosen encoding (see htmlEncodingFor). */
export function compressHtml(html: string, encoding: HtmlEncoding): Buffer {
  return COMPRESSORS[encoding](Buffer.from(html));
}
