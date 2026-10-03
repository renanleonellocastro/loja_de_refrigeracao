import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { createLocalStorage } from '../../infra/storage/storage.js';
import { gif, jpeg } from '../../../test/images.js';
import { multipart } from '../../../test/multipart.js';
import { useTestApp } from '../../../test/harness.js';
import { imageView, mediaUrl, storeImage, variantWidths } from './images.js';
import { imageSchema } from './schemas.js';
import { readMultipart } from './uploads.js';

describe('image pipeline', () => {
  const storage = createLocalStorage(mkdtempSync(join(tmpdir(), 'rc-images-')));

  it('stores WebP variants up to the original width, without metadata', async () => {
    const stored = await storeImage(storage, await jpeg(1000, 600));
    expect(stored).toMatchObject({ width: 1000, height: 600 });
    expect(stored.key).toMatch(/^[a-f0-9]{32}$/);
    for (const width of [320, 640, 960]) {
      const variant = await storage.get(`${stored.key}/${width}.webp`);
      const meta = await sharp(variant!).metadata();
      expect(meta).toMatchObject({ format: 'webp', width });
      expect(meta.exif).toBeUndefined();
    }
    expect(await storage.get(`${stored.key}/1440.webp`)).toBeNull();
  });

  it('applies the camera orientation', async () => {
    const stored = await storeImage(storage, await jpeg(800, 400, 6));
    expect(stored).toMatchObject({ width: 400, height: 800 });
  });

  it('keeps a single variant for tiny images, never enlarging them', async () => {
    const stored = await storeImage(storage, await jpeg(100, 80));
    const meta = await sharp((await storage.get(`${stored.key}/320.webp`))!).metadata();
    expect(meta.width).toBe(100);
  });

  it('rejects files that are not accepted photos', async () => {
    await expect(storeImage(storage, Buffer.from('not an image'))).rejects.toMatchObject({ status: 415 });
    await expect(storeImage(storage, await gif())).rejects.toMatchObject({ status: 415 });
  });

  it('describes images for the API', () => {
    expect(imageSchema.parse(imageView({ key: 'k', width: 10, height: 10 })).url).toBe(
      '/api/v1/media/k/320.webp',
    );
    expect(variantWidths(5000)).toEqual([320, 640, 960, 1440]);
    expect(variantWidths(10)).toEqual([320]);
    expect(mediaUrl('k', 640)).toBe('/api/v1/media/k/640.webp');
    expect(imageView({ key: 'k', width: 700, height: 500 })).toEqual({
      width: 700,
      height: 500,
      url: '/api/v1/media/k/640.webp',
      srcset: '/api/v1/media/k/320.webp 320w, /api/v1/media/k/640.webp 640w',
    });
  });
});

describe('media routes and multipart', () => {
  const t = useTestApp();

  it('serves stored variants with long lived cache headers', async () => {
    const stored = await storeImage(t.ctx.storage, await jpeg(400, 300));
    const response = await t.app.inject({ method: 'GET', url: mediaUrl(stored.key, 320) });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('answers 404 for missing variants and 422 for malformed keys', async () => {
    expect(
      (await t.app.inject({ method: 'GET', url: `/api/v1/media/${'a'.repeat(32)}/320.webp` })).statusCode,
    ).toBe(404);
    expect(
      (await t.app.inject({ method: 'GET', url: '/api/v1/media/..%2F..%2Fetc/320.webp' })).statusCode,
    ).toBe(422);
  });

  it('reads files and fields from multipart requests', async () => {
    const app = (await import('../../app.js')).buildApp;
    const instance = await app(t.ctx);
    instance.post('/upload-test', async (request) => {
      const form = await readMultipart(request, 2);
      return { files: form.files.map((f) => f.length), fields: form.fields };
    });
    const body = multipart([
      { name: 'descricao', value: 'Geladeira não gela' },
      { name: 'fotos', value: Buffer.from('12345'), filename: 'a.jpg', contentType: 'image/jpeg' },
    ]);
    const ok = await instance.inject({ method: 'POST', url: '/upload-test', ...body });
    expect(ok.json()).toEqual({ files: [5], fields: { descricao: 'Geladeira não gela' } });

    const many = multipart(
      [1, 2, 3].map((n) => ({ name: 'f', value: Buffer.from([n]), filename: `${n}.jpg` })),
    );
    const tooMany = await instance.inject({ method: 'POST', url: '/upload-test', ...many });
    expect(tooMany.json()).toMatchObject({ status: 422, title: 'Fotos demais' });

    const json = await instance.inject({ method: 'POST', url: '/upload-test', payload: { a: 1 } });
    expect(json.json()).toMatchObject({ status: 422, title: 'Formato inválido' });

    const big = multipart([{ name: 'f', value: Buffer.alloc(9 * 1024 * 1024), filename: 'big.jpg' }]);
    const tooBig = await instance.inject({ method: 'POST', url: '/upload-test', ...big });
    expect(tooBig.statusCode).toBe(413);
    await instance.close();
  });
});
