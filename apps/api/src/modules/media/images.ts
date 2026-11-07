import { createHash } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import type { Storage } from '../../infra/storage/storage.js';
import { AppError } from '../../shared/errors.js';

/** Responsive widths served for every photo (docs/ARQUITETURA.md, ADR 0010). */
export const IMAGE_WIDTHS = [320, 640, 960, 1440] as const;
/** Formats of every variant, the lightest first: browsers take the first one they support. */
export const VARIANT_FORMATS = ['avif', 'webp'] as const;
export type VariantFormat = (typeof VARIANT_FORMATS)[number];
/** The upright copy without metadata that the worker turns into variants. */
export const ORIGINAL_FILE = 'original.webp';
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
/** Twice the largest variant: sharp enough for every screen, small enough to keep. */
const ORIGINAL_MAX_SIZE = 2 * IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]!;
const ORIGINAL_QUALITY = 90;

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

/** Upright, at most ORIGINAL_MAX_SIZE on its longest side, without EXIF (sharp drops metadata unless asked). */
function normalizedOriginal(data: Buffer) {
  return sharp(data)
    .rotate()
    .resize({ width: ORIGINAL_MAX_SIZE, height: ORIGINAL_MAX_SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: ORIGINAL_QUALITY })
    .toBuffer({ resolveWithObject: true });
}

/**
 * Validates the real content (not the declared type), fixes the orientation, drops EXIF data
 * including GPS, and stores the original under a content addressed key. The variants come later.
 */
export async function saveOriginal(storage: Storage, data: Buffer): Promise<StoredImage> {
  await assertAcceptedPhoto(data);
  const original = await normalizedOriginal(data);
  const key = contentKey(data);
  await storage.put(`${key}/${ORIGINAL_FILE}`, original.data);
  return { key, width: original.info.width, height: original.info.height };
}

export function mediaUrl(key: string, width: number, format: VariantFormat = 'webp'): string {
  return `/api/v1/media/${key}/${width}.${format}`;
}

function srcsetOf(key: string, widths: number[], format: VariantFormat): string {
  return widths.map((width) => `${mediaUrl(key, width, format)} ${width}w`).join(', ');
}

/** Public shape of an image: the largest WebP plus srcsets in WebP and AVIF for responsive loading. */
export function imageView(image: StoredImage) {
  const widths = variantWidths(image.width);
  return {
    width: image.width,
    height: image.height,
    url: mediaUrl(image.key, widths[widths.length - 1]!),
    srcset: srcsetOf(image.key, widths, 'webp'),
    avifSrcset: srcsetOf(image.key, widths, 'avif'),
  };
}
