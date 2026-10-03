import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage, fitWithin } from '~/utils/image';

describe('fitWithin', () => {
  it('scales down the longest side and never scales up', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
});

describe('compressImage', () => {
  const photo = new File(['x'], 'geladeira.png', { type: 'image/png', lastModified: 7 });

  function stubCanvas(blob: Blob | null, context: unknown = { drawImage: vi.fn() }) {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4096, height: 2048, close: vi.fn() })),
    );
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((resolve: (b: Blob | null) => void) => resolve(blob)),
    };
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : original(tag),
    );
    return canvas;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps files that are not images', async () => {
    const pdf = new File(['x'], 'nota.pdf', { type: 'application/pdf' });
    expect(await compressImage(pdf)).toBe(pdf);
  });

  it('resizes to 2048 px and encodes as JPEG by default', async () => {
    const canvas = stubCanvas(new Blob(['y'], { type: 'image/jpeg' }));
    const result = await compressImage(photo);
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1024);
    expect(result.name).toBe('geladeira.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(result.lastModified).toBe(7);
  });

  it('encodes WebP when asked', async () => {
    stubCanvas(new Blob(['y'], { type: 'image/webp' }));
    const result = await compressImage(photo, { type: 'image/webp', maxSize: 1024, quality: 0.7 });
    expect(result.name).toBe('geladeira.webp');
  });

  it('falls back to the original when encoding fails', async () => {
    stubCanvas(null);
    expect(await compressImage(photo)).toBe(photo);
  });

  it('falls back to the original without a 2D context', async () => {
    stubCanvas(new Blob(['y']), null);
    expect(await compressImage(photo)).toBe(photo);
  });

  it('falls back to the original when decoding throws', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('bad image');
      }),
    );
    expect(await compressImage(photo)).toBe(photo);
  });
});
