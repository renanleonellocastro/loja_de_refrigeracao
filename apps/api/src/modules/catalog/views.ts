import { imageView } from '../media/service.js';
import type { ProductImageRow, ProductWithCategory } from './repository.js';

/** Below the minimum of the product, or of the store when the product has none (RF-17). */
export function isLowStock(product: { stockAvailable: number; stockMin: number | null }, storeMin: number) {
  return product.stockAvailable < (product.stockMin ?? storeMin);
}

export function toImageView(image: ProductImageRow) {
  return {
    id: image.id,
    position: image.position,
    isCover: image.isCover,
    ...imageView({ key: image.storageKey, width: image.width, height: image.height }),
  };
}

function baseView(product: ProductWithCategory, storeMin: number) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    brand: product.brand,
    model: product.model,
    condition: product.condition,
    priceCents: product.priceCents,
    stockAvailable: product.stockAvailable,
    stockMin: product.stockMin,
    available: product.stockAvailable > 0,
    lowStock: isLowStock(product, storeMin),
    archived: product.archivedAt !== null,
  };
}

export function toSummary(
  product: ProductWithCategory,
  cover: ProductImageRow | undefined,
  storeMin: number,
) {
  return { ...baseView(product, storeMin), cover: cover ? toImageView(cover) : null };
}

export function toDetail(product: ProductWithCategory, images: ProductImageRow[], storeMin: number) {
  return {
    ...baseView(product, storeMin),
    description: product.description,
    images: images.map(toImageView),
    version: product.version,
    archivedAt: product.archivedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export type ProductDetail = ReturnType<typeof toDetail>;
