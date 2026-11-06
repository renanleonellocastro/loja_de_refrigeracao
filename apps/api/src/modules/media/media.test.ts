import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { createLocalStorage } from '../../infra/storage/storage.js';
import { gif, jpeg } from '../../../test/images.js';
import { multipart } from '../../../test/multipart.js';
import { useTestApp } from '../../../test/harness.js';
import { ORIGINAL_FILE, imageView, mediaUrl, saveOriginal, variantWidths } from './images.js';
import { generateVariants, imageVariantsHandler, storeImage, storeImageNow } from './variants.js';
import { imageSchema } from './schemas.js';
import { readMultipart } from './uploads.js';

describe('image pipeline', () => {
  const storage = createLocalStorage(mkdtempSync(join(tmpdir(), 'rc-images-')));
  const formatOf = async (key: string) => (await sharp((await storage.get(key))!).metadata()).format;

  it('saves an upright original without metadata and no variants yet', async () => {
    const stored = await saveOriginal(storage, await jpeg(800, 400, 6));
    expect(stored).toMatchObject({ width: 400, height: 800 });
    expect(stored.key).toMatch(/^[a-f0-9]{32}$/);
    const meta = await sharp((await storage.get(`${stored.key}/${ORIGINAL_FILE}`))!).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 400, height: 800 });
    expect(meta.exif).toBeUndefined();
    expect(await storage.get(`${stored.key}/320.webp`)).toBeNull();
  });

  it('caps the original at twice the largest variant', async () => {
    expect(await saveOriginal(storage, await jpeg(3200, 1600))).toMatchObject({ width: 2880, height: 1440 });
  });

  it('generates AVIF and WebP variants up to the original width, without metadata', async () => {
    const stored = await storeImageNow(storage, await jpeg(1000, 600));
    for (const width of [320, 640, 960]) {
      const avif = await sharp((await storage.get(`${stored.key}/${width}.avif`))!).metadata();
      expect(avif).toMatchObject({ format: 'heif', compression: 'av1', width });
      const webp = await sharp((await storage.get(`${stored.key}/${width}.webp`))!).metadata();
      expect(webp).toMatchObject({ format: 'webp', width });
      expect(webp.exif).toBeUndefined();
    }
    expect(await storage.get(`${stored.key}/1440.avif`)).toBeNull();
  });

  it('keeps a single variant for tiny images, never enlarging them', async () => {
    const stored = await storeImageNow(storage, await jpeg(100, 80));
    const meta = await sharp((await storage.get(`${stored.key}/320.webp`))!).metadata();
    expect(meta.width).toBe(100);
    expect(await formatOf(`${stored.key}/320.avif`)).toBe('heif');
  });

  it('skips the variants when the original is gone', async () => {
    await generateVariants(storage, 'f'.repeat(32));
    expect(await storage.get(`${'f'.repeat(32)}/320.webp`)).toBeNull();
  });

  it('rejects files that are not accepted photos', async () => {
    await expect(saveOriginal(storage, Buffer.from('not an image'))).rejects.toMatchObject({ status: 415 });
    await expect(saveOriginal(storage, await gif())).rejects.toMatchObject({ status: 415 });
  });

  it('describes images for the API', () => {
    expect(imageSchema.parse(imageView({ key: 'k', width: 10, height: 10 })).url).toBe(
      '/api/v1/media/k/320.webp',
    );
    expect(variantWidths(5000)).toEqual([320, 640, 960, 1440]);
    expect(variantWidths(10)).toEqual([320]);
    expect(mediaUrl('k', 640)).toBe('/api/v1/media/k/640.webp');
    expect(mediaUrl('k', 640, 'avif')).toBe('/api/v1/media/k/640.avif');
    expect(imageView({ key: 'k', width: 700, height: 500 })).toEqual({
      width: 700,
      height: 500,
      url: '/api/v1/media/k/640.webp',
      srcset: '/api/v1/media/k/320.webp 320w, /api/v1/media/k/640.webp 640w',
      avifSrcset: '/api/v1/media/k/320.avif 320w, /api/v1/media/k/640.avif 640w',
    });
  });
});

describe('image variants job', () => {
  const t = useTestApp();

  it('queues the variants on upload and the worker writes them', async () => {
    const stored = await storeImage(t.ctx, await jpeg(700, 500));
    expect(await t.ctx.storage.get(`${stored.key}/640.avif`)).toBeNull();
    expect(await t.deliverEmails()).toEqual({ processed: 1, failed: 0 });
    expect(await t.ctx.storage.get(`${stored.key}/640.avif`)).not.toBeNull();
    expect(await t.ctx.storage.get(`${stored.key}/640.webp`)).not.toBeNull();
  });

  it('refuses events whose key is not a content key', async () => {
    await expect(imageVariantsHandler(t.ctx.storage)({ key: '../x' })).rejects.toThrow('Invalid image key');
  });
});

describe('media routes and multipart', () => {
  const t = useTestApp();

  it('serves stored variants with long lived cache headers', async () => {
    const stored = await storeImageNow(t.ctx.storage, await jpeg(400, 300));
    for (const [format, type] of [
      ['webp', 'image/webp'],
      ['avif', 'image/avif'],
    ] as const) {
      const response = await t.app.inject({ method: 'GET', url: mediaUrl(stored.key, 320, format) });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe(type);
      expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    }
  });

  it('serves the original without cache until the worker writes the variant', async () => {
    const stored = await storeImage(t.ctx, await jpeg(410, 300));
    const response = await t.app.inject({ method: 'GET', url: mediaUrl(stored.key, 320, 'avif') });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['cache-control']).toBe('no-store');
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
