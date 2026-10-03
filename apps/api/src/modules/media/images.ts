import { createHash } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import type { Storage } from '../../infra/storage/storage.js';
import { AppError } from '../../shared/errors.js';

/** Responsive widths served for every photo (docs/ARQUITETURA.md, ADR 0010). */
export const IMAGE_WIDTHS = [320, 640, 960, 1440] as const;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif']);

export interface StoredImage {
  key: string;
  width: number;
  height: number;
}

export const unsupportedImage = () =>
  new AppError(
    415,
    'unsupported-image',
    'Formato de imagem não aceito',
    'Envie fotos em JPEG, PNG, WebP ou HEIC.',
  );

export function variantWidths(originalWidth: number): number[] {
  const widths = IMAGE_WIDTHS.filter((width) => width <= originalWidth);
  return widths.length > 0 ? widths : [IMAGE_WIDTHS[0]];
}

/**
 * Validates the real content (not the declared type), fixes the orientation, drops EXIF data
 * including GPS, and stores WebP variants under a content addressed key.
 */
export async function storeImage(storage: Storage, data: Buffer): Promise<StoredImage> {
  let metadata: Metadata;
  try {
    metadata = await sharp(data).metadata();
  } catch {
    throw unsupportedImage();
  }
  if (!ACCEPTED_FORMATS.has(String(metadata.format))) throw unsupportedImage();

  const { info } = await sharp(data).rotate().toBuffer({ resolveWithObject: true });
  const key = createHash('sha256').update(data).digest('hex').slice(0, 32);
  for (const width of variantWidths(info.width)) {
    const variant = await sharp(data)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    await storage.put(`${key}/${width}.webp`, variant);
  }
  return { key, width: info.width, height: info.height };
}

export function mediaUrl(key: string, width: number): string {
  return `/api/v1/media/${key}/${width}.webp`;
}

/** Public shape of an image: the largest URL plus a srcset for responsive loading. */
export function imageView(image: StoredImage) {
  const widths = variantWidths(image.width);
  return {
    width: image.width,
    height: image.height,
    url: mediaUrl(image.key, widths[widths.length - 1]!),
    srcset: widths.map((w) => `${mediaUrl(image.key, w)} ${w}w`).join(', '),
  };
}
