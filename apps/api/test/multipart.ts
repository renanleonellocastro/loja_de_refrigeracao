import { randomUUID } from 'node:crypto';

export interface MultipartPart {
  name: string;
  value: string | Buffer;
  filename?: string;
  contentType?: string;
}

/** Builds a multipart/form-data payload for app.inject. */
export function multipart(parts: MultipartPart[]) {
  const boundary = `----rc${randomUUID()}`;
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `form-data; name="${part.name}"; filename="${part.filename}"`
      : `form-data; name="${part.name}"`;
    const type = part.filename ? `\r\nContent-Type: ${part.contentType ?? 'application/octet-stream'}` : '';
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: ${disposition}${type}\r\n\r\n`));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}
