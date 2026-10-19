import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { storeImage, type StoredImage } from '../media/service.js';
import { auditProductChange, type AuditMeta } from './audit.js';
import { isCompleteOrder } from './ordering.js';
import {
  imageNotFound,
  imageRequired,
  invalidCover,
  invalidImageOrder,
  productNotFound,
  tooManyImages,
} from './problems.js';
import * as repo from './repository.js';
import { findForStaff } from './products.js';
import { MAX_IMAGES_PER_PRODUCT } from './schemas.js';
import { removeUnusedKeys } from './storage-cleanup.js';
import { toImageView } from './views.js';

interface GalleryOrder {
  imageIds: number[];
  coverId?: number | undefined;
}

function keysOf(images: readonly StoredImage[]): string[] {
  return images.map((image) => image.key);
}

async function gallery(db: Executor, productId: number) {
  return (await repo.listImages(db, productId)).map(toImageView);
}

async function lockedProduct(db: Executor, id: number) {
  const product = await repo.lockProduct(db, id);
  if (!product) throw productNotFound();
  return product;
}

function assertRoomFor(currentCount: number, addedCount: number): void {
  if (currentCount + addedCount > MAX_IMAGES_PER_PRODUCT)
    throw tooManyImages(MAX_IMAGES_PER_PRODUCT - currentCount);
}

async function appendAuditedImages(tx: Executor, productId: number, stored: StoredImage[], meta: AuditMeta) {
  await lockedProduct(tx, productId);
  // Checked again under the lock: another upload may have finished in the meantime.
  assertRoomFor((await repo.listImages(tx, productId)).length, stored.length);
  await repo.insertImages(tx, productId, stored);
  await auditProductChange(tx, meta, productId, {
    action: 'product.images.add',
    after: { keys: keysOf(stored) },
  });
  return gallery(tx, productId);
}

/**
 * Stores the photos (validated by their bytes, without EXIF) and appends them to the gallery in
 * the order sent. The first photo a product ever gets becomes its cover.
 */
export async function addImages(ctx: AppContext, productId: number, files: Buffer[], meta: AuditMeta) {
  if (files.length === 0) throw imageRequired();
  await findForStaff(ctx.db, productId);
  assertRoomFor((await repo.listImages(ctx.db, productId)).length, files.length);
  const stored: StoredImage[] = [];
  try {
    for (const file of files) stored.push(await storeImage(ctx.storage, file));
    return await ctx.db.transaction((tx) => appendAuditedImages(tx, productId, stored, meta));
  } catch (error) {
    // Nothing was saved: drop the files stored for this request (unless another row uses them).
    await removeUnusedKeys(ctx, keysOf(stored));
    throw error;
  }
}

/** The cover after the reorder: the one chosen, or the current cover when none was. */
function chosenCover(images: repo.ProductImageRow[], coverId: number | undefined): number {
  const cover = coverId ?? images.find((image) => image.isCover)!.id;
  if (!images.some((image) => image.id === cover)) throw invalidCover();
  return cover;
}

async function reorderAuditedImages(tx: Executor, productId: number, order: GalleryOrder, meta: AuditMeta) {
  await lockedProduct(tx, productId);
  const images = await repo.listImages(tx, productId);
  const currentIds = images.map((image) => image.id);
  if (!isCompleteOrder(order.imageIds, currentIds)) throw invalidImageOrder();
  const coverId = chosenCover(images, order.coverId);
  await repo.setImageOrder(tx, productId, order.imageIds, coverId);
  await auditProductChange(tx, meta, productId, {
    action: 'product.images.reorder',
    before: currentIds,
    after: { imageIds: order.imageIds, coverId },
  });
  return gallery(tx, productId);
}

/** Replaces the gallery order; `coverId` picks the cover (the current one is kept when absent). */
export async function reorderImages(
  ctx: AppContext,
  productId: number,
  order: GalleryOrder,
  meta: AuditMeta,
) {
  return ctx.db.transaction((tx) => reorderAuditedImages(tx, productId, order, meta));
}

async function galleryImage(tx: Executor, productId: number, imageId: number) {
  const image = (await repo.listImages(tx, productId)).find((row) => row.id === imageId);
  if (!image) throw imageNotFound();
  return image;
}

/** Returns the storage key of the removed photo, to delete the file after the commit. */
async function removeAuditedImage(tx: Executor, productId: number, imageId: number, meta: AuditMeta) {
  await lockedProduct(tx, productId);
  const image = await galleryImage(tx, productId, imageId);
  await repo.deleteImage(tx, imageId);
  if (image.isCover) await repo.promoteFirstImage(tx, productId);
  await auditProductChange(tx, meta, productId, {
    action: 'product.images.remove',
    before: { imageId, key: image.storageKey, isCover: image.isCover },
  });
  return image.storageKey;
}

/** Removes a photo; when it was the cover, the next photo of the gallery becomes the cover. */
export async function removeImage(ctx: AppContext, productId: number, imageId: number, meta: AuditMeta) {
  const key = await ctx.db.transaction((tx) => removeAuditedImage(tx, productId, imageId, meta));
  await removeUnusedKeys(ctx, [key]);
}
