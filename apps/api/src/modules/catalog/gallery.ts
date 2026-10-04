import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { notFound, unprocessable } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import { storeImage, type StoredImage } from '../media/service.js';
import type { AuditMeta } from './categories.js';
import * as repo from './repository.js';
import { findForStaff } from './products.js';
import { MAX_IMAGES_PER_PRODUCT } from './schemas.js';
import { removeUnusedKeys } from './storage-cleanup.js';
import { toImageView } from './views.js';

async function gallery(db: Executor, productId: number) {
  return (await repo.listImages(db, productId)).map(toImageView);
}

async function lockedProduct(db: Executor, id: number) {
  const product = await repo.lockProduct(db, id);
  if (!product) throw notFound('Produto não encontrado.');
  return product;
}

const tooManyImages = (room: number) =>
  unprocessable(
    'too-many-images',
    'Fotos demais',
    room > 0
      ? `Cada produto pode ter até ${MAX_IMAGES_PER_PRODUCT} fotos. Envie no máximo mais ${room}.`
      : `Este produto já tem ${MAX_IMAGES_PER_PRODUCT} fotos. Remova alguma antes de enviar outra.`,
  );

/**
 * Stores the photos (validated by their bytes, without EXIF) and appends them to the gallery in
 * the order sent. The first photo a product ever gets becomes its cover.
 */
export async function addImages(ctx: AppContext, productId: number, files: Buffer[], meta: AuditMeta) {
  if (files.length === 0) {
    throw unprocessable('image-required', 'Nenhuma foto enviada', 'Escolha ao menos uma foto.');
  }
  await findForStaff(ctx.db, productId);
  const existing = await repo.listImages(ctx.db, productId);
  if (existing.length + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw tooManyImages(MAX_IMAGES_PER_PRODUCT - existing.length);
  }
  const stored: StoredImage[] = [];
  try {
    for (const file of files) stored.push(await storeImage(ctx.storage, file));
    return await ctx.db.transaction(async (tx) => {
      await lockedProduct(tx, productId);
      // Checked again under the lock: another upload may have finished in the meantime.
      const count = (await repo.listImages(tx, productId)).length;
      if (count + stored.length > MAX_IMAGES_PER_PRODUCT) throw tooManyImages(MAX_IMAGES_PER_PRODUCT - count);
      await repo.insertImages(tx, productId, stored);
      await recordAudit(tx, {
        actorId: meta.actor.userId,
        action: 'product.images.add',
        resourceType: 'product',
        resourceId: productId,
        after: { keys: stored.map((image) => image.key) },
        ip: meta.ip,
      });
      return gallery(tx, productId);
    });
  } catch (error) {
    // Nothing was saved: drop the files stored for this request (unless another row uses them).
    await removeUnusedKeys(
      ctx,
      stored.map((image) => image.key),
    );
    throw error;
  }
}

/** Replaces the gallery order; `coverId` picks the cover (the current one is kept when absent). */
export async function reorderImages(
  ctx: AppContext,
  productId: number,
  input: { imageIds: number[]; coverId?: number | undefined },
  meta: AuditMeta,
) {
  return ctx.db.transaction(async (tx) => {
    await lockedProduct(tx, productId);
    const images = await repo.listImages(tx, productId);
    const ids = new Set(images.map((image) => image.id));
    const sent = new Set(input.imageIds);
    if (
      sent.size !== input.imageIds.length ||
      sent.size !== ids.size ||
      input.imageIds.some((id) => !ids.has(id))
    ) {
      throw unprocessable(
        'invalid-image-order',
        'Ordem inválida',
        'Envie todas as fotos do produto, cada uma uma única vez.',
        {
          errors: [{ path: 'imageIds', message: 'Envie todas as fotos do produto, cada uma uma única vez.' }],
        },
      );
    }
    const coverId = input.coverId ?? images.find((image) => image.isCover)!.id;
    if (!ids.has(coverId)) {
      throw unprocessable('invalid-cover', 'Capa inválida', 'A capa deve ser uma das fotos do produto.', {
        errors: [{ path: 'coverId', message: 'A capa deve ser uma das fotos do produto.' }],
      });
    }
    await repo.setImageOrder(tx, productId, input.imageIds, coverId);
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'product.images.reorder',
      resourceType: 'product',
      resourceId: productId,
      before: images.map((image) => image.id),
      after: { imageIds: input.imageIds, coverId },
      ip: meta.ip,
    });
    return gallery(tx, productId);
  });
}

/** Removes a photo; when it was the cover, the next photo of the gallery becomes the cover. */
export async function removeImage(ctx: AppContext, productId: number, imageId: number, meta: AuditMeta) {
  const key = await ctx.db.transaction(async (tx) => {
    await lockedProduct(tx, productId);
    const image = (await repo.listImages(tx, productId)).find((row) => row.id === imageId);
    if (!image) throw notFound('Foto não encontrada.');
    await repo.deleteImage(tx, imageId);
    if (image.isCover) await repo.promoteFirstImage(tx, productId);
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'product.images.remove',
      resourceType: 'product',
      resourceId: productId,
      before: { imageId, key: image.storageKey, isCover: image.isCover },
      ip: meta.ip,
    });
    return image.storageKey;
  });
  await removeUnusedKeys(ctx, [key]);
}
