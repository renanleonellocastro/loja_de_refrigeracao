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

/** Hex digits of the SHA-256 kept in a storage key: 128 bits are enough to never collide. */
const CONTENT_KEY_LENGTH = 32;
const WEBP_QUALITY = 80;

async function readMetadata(data: Buffer): Promise<Metadata> {
  try {
    return await sharp(data).metadata();
  } catch {
    throw unsupportedImage();
  }
}

/** Checks the real content of the file, not the type the client declared. */
async function assertAcceptedPhoto(data: Buffer): Promise<void> {
  const metadata = await readMetadata(data);
  if (!ACCEPTED_FORMATS.has(String(metadata.format))) throw unsupportedImage();
}

function contentKey(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').slice(0, CONTENT_KEY_LENGTH);
}

/** A WebP copy at `width`, upright and without EXIF data (sharp drops metadata unless asked to keep it). */
function webpVariant(data: Buffer, width: number): Promise<Buffer> {
  return sharp(data)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/**
 * Validates the real content (not the declared type), fixes the orientation, drops EXIF data
 * including GPS, and stores WebP variants under a content addressed key.
 */
export async function storeImage(storage: Storage, data: Buffer): Promise<StoredImage> {
  await assertAcceptedPhoto(data);
  const { info } = await sharp(data).rotate().toBuffer({ resolveWithObject: true });
  const key = contentKey(data);
  for (const width of variantWidths(info.width)) {
    await storage.put(`${key}/${width}.webp`, await webpVariant(data, width));
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
    srcset: widths.map((width) => `${mediaUrl(image.key, width)} ${width}w`).join(', '),
  };
}
