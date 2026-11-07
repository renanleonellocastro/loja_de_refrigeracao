import sharp, { type Sharp } from 'sharp';
import type { AppContext } from '../../context.js';
import type { Storage } from '../../infra/storage/storage.js';
import { enqueue, type OutboxHandler } from '../outbox/service.js';
import {
  ORIGINAL_FILE,
  VARIANT_FORMATS,
  saveOriginal,
  variantWidths,
  type StoredImage,
  type VariantFormat,
} from './images.js';

/** Outbox topic of the job that turns a stored original into its variants. */
export const IMAGE_VARIANTS_TOPIC = 'media.variants';

const ENCODERS: Record<VariantFormat, (image: Sharp) => Sharp> = {
  avif: (image) => image.avif({ quality: 50, effort: 4 }),
  webp: (image) => image.webp({ quality: 80 }),
};

function encodeVariant(original: Buffer, width: number, format: VariantFormat): Promise<Buffer> {
  return ENCODERS[format](sharp(original).resize({ width, withoutEnlargement: true })).toBuffer();
}

async function writeVariants(storage: Storage, key: string, original: Buffer): Promise<void> {
  const { width } = await sharp(original).metadata();
  for (const variantWidth of variantWidths(width)) {
    for (const format of VARIANT_FORMATS) {
      await storage.put(
        `${key}/${variantWidth}.${format}`,
        await encodeVariant(original, variantWidth, format),
      );
    }
  }
}

/**
 * Writes AVIF and WebP at every width up to the original's. Safe to repeat; does nothing when the
 * original is gone (the upload failed and its files were removed).
 */
export async function generateVariants(storage: Storage, key: string): Promise<void> {
  const original = await storage.get(`${key}/${ORIGINAL_FILE}`);
  if (original) await writeVariants(storage, key, original);
}

const CONTENT_KEY = /^[a-f0-9]{32}$/;

export function imageVariantsHandler(storage: Storage): OutboxHandler {
  return async (payload) => {
    const key = String(payload.key);
    if (!CONTENT_KEY.test(key)) throw new Error(`Invalid image key: ${key}`);
    await generateVariants(storage, key);
  };
}

/** Saves the original now and leaves the variants to the worker, so uploads answer quickly. */
export async function storeImage(
  ctx: Pick<AppContext, 'db' | 'storage'>,
  data: Buffer,
): Promise<StoredImage> {
  const stored = await saveOriginal(ctx.storage, data);
  await enqueue(ctx.db, IMAGE_VARIANTS_TOPIC, { key: stored.key });
  return stored;
}

/** Original and variants at once, for the development seed that runs without the worker. */
export async function storeImageNow(storage: Storage, data: Buffer): Promise<StoredImage> {
  const stored = await saveOriginal(storage, data);
  await generateVariants(storage, stored.key);
  return stored;
}
