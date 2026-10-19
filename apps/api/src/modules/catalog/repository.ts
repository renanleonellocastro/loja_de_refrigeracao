import { and, asc, count, desc, eq, getTableColumns, inArray, isNull, max, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import {
  categories,
  media,
  orderItems,
  productImages,
  products,
  stockMovements,
  storeSettings,
  users,
} from '../../infra/db/schema.js';
import { normalizeText } from '../../shared/text.js';
import type { StoredImage } from '../media/service.js';

export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;
export type StockMovementRow = typeof stockMovements.$inferSelect;
export type StockMovementType = StockMovementRow['type'];
export type ProductWithCategory = ProductRow & { categoryName: string };

/** The rows of one page, from `toLimitOffset`. */
export interface PageWindow {
  limit: number;
  offset: number;
}

// Categories

export async function listCategories(db: Executor) {
  return db
    .select({
      ...getTableColumns(categories),
      productCount: sql<number>`count(${products.id}) filter (where ${products.archivedAt} is null)`.mapWith(
        Number,
      ),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.name), asc(categories.id));
}

export async function findCategory(db: Executor, id: number): Promise<CategoryRow | undefined> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row;
}

export async function findCategoryByName(db: Executor, name: string): Promise<CategoryRow | undefined> {
  const [row] = await db
    .select()
    .from(categories)
    .where(sql`lower(${categories.name}) = ${name.toLowerCase()}`)
    .limit(1);
  return row;
}

/** New categories go to the end of the list. */
export async function insertCategory(db: Executor, name: string): Promise<CategoryRow> {
  const [row] = await db
    .insert(categories)
    .values({
      name,
      position: sql`(select coalesce(max(${categories.position}) + 1, 0) from ${categories})`,
    })
    .returning();
  return row!;
}

export async function renameCategory(db: Executor, id: number, name: string, now: Date) {
  await db.update(categories).set({ name, updatedAt: now }).where(eq(categories.id, id));
}

/** Every product of the category, archived ones included (they still reference it). */
export async function countProductsInCategory(db: Executor, categoryId: number): Promise<number> {
  const [row] = await db.select({ value: count() }).from(products).where(eq(products.categoryId, categoryId));
  return row!.value;
}

export async function moveProducts(db: Executor, fromId: number, toId: number, now: Date): Promise<number> {
  const moved = await db
    .update(products)
    .set({ categoryId: toId, updatedAt: now })
    .where(eq(products.categoryId, fromId))
    .returning({ id: products.id });
  return moved.length;
}

export async function deleteCategory(db: Executor, id: number): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}

export async function categoryIds(db: Executor): Promise<number[]> {
  const rows = await db.select({ id: categories.id }).from(categories);
  return rows.map((row) => row.id);
}

export async function setCategoryPositions(db: Executor, ids: number[], now: Date): Promise<void> {
  for (const [position, id] of ids.entries()) {
    await db.update(categories).set({ position, updatedAt: now }).where(eq(categories.id, id));
  }
}

// Products

export function productSearchText(
  product: { name: string; brand?: string | null; model?: string | null },
  categoryName: string,
): string {
  return normalizeText([product.name, product.brand ?? '', product.model ?? '', categoryName].join(' '));
}

/** Recomputes the search text of every product of a category (after a rename or a move). */
export async function refreshCategorySearchText(db: Executor, categoryId: number): Promise<void> {
  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId));
  const rows = await db
    .select({ id: products.id, name: products.name, brand: products.brand, model: products.model })
    .from(products)
    .where(eq(products.categoryId, categoryId));
  for (const row of rows) {
    await db
      .update(products)
      .set({ searchText: productSearchText(row, category!.name) })
      .where(eq(products.id, row.id));
  }
}

/** Serializes slug allocation until the end of the transaction. */
export async function lockSlugAllocation(db: Executor): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext('products.slug'))`);
}

export async function slugsLike(db: Executor, base: string): Promise<string[]> {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(sql`${products.slug} = ${base} or ${products.slug} ~ ${`^${base}-[0-9]+$`}`);
  return rows.map((row) => row.slug);
}

export type NewProduct = Omit<typeof products.$inferInsert, 'id' | 'searchText'>;

export async function insertProduct(db: Executor, product: NewProduct, categoryName: string) {
  const [row] = await db
    .insert(products)
    .values({ ...product, searchText: productSearchText(product, categoryName) })
    .returning();
  return row!;
}

export const productWithCategory = { ...getTableColumns(products), categoryName: categories.name };

export async function findProduct(db: Executor, id: number): Promise<ProductWithCategory | undefined> {
  const [row] = await db
    .select(productWithCategory)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id))
    .limit(1);
  return row;
}

export async function findProductBySlug(
  db: Executor,
  slug: string,
): Promise<ProductWithCategory | undefined> {
  const [row] = await db
    .select(productWithCategory)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.slug, slug))
    .limit(1);
  return row;
}

export type ProductChanges = Partial<
  Pick<
    ProductRow,
    'name' | 'categoryId' | 'brand' | 'model' | 'condition' | 'description' | 'priceCents' | 'stockMin'
  >
>;

/**
 * Applies the changes only if the product is still at `version` (optimistic concurrency).
 * Returns false when someone else changed it first.
 */
export async function updateProductAtVersion(
  db: Executor,
  current: ProductRow,
  changes: ProductChanges,
  categoryName: string,
  now: Date,
): Promise<boolean> {
  const merged = { ...current, ...changes };
  const updated = await db
    .update(products)
    .set({
      ...changes,
      searchText: productSearchText(merged, categoryName),
      version: current.version + 1,
      updatedAt: now,
    })
    .where(and(eq(products.id, current.id), eq(products.version, current.version)))
    .returning({ id: products.id });
  return updated.length === 1;
}

export async function setArchivedAt(db: Executor, id: number, archivedAt: Date | null, now: Date) {
  await db
    .update(products)
    .set({ archivedAt, version: sql`${products.version} + 1`, updatedAt: now })
    .where(eq(products.id, id));
}

export async function productHasOrders(db: Executor, id: number): Promise<boolean> {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.productId, id))
    .limit(1);
  return row !== undefined;
}

/** Deletes the product with its images, stock movements and cart items (cascades). */
export async function deleteProduct(db: Executor, id: number): Promise<void> {
  await db.delete(products).where(eq(products.id, id));
}

// Images

/** Gallery order: cover first, then by position. */
export async function listImages(db: Executor, productId: number): Promise<ProductImageRow[]> {
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(desc(productImages.isCover), asc(productImages.position), asc(productImages.id));
}

export async function coversOf(db: Executor, productIds: number[]): Promise<ProductImageRow[]> {
  if (productIds.length === 0) return [];
  return db
    .select()
    .from(productImages)
    .where(and(inArray(productImages.productId, productIds), eq(productImages.isCover, true)));
}

/** Locks the product row so concurrent gallery or stock changes of the same product run one at a time. */
export async function lockProduct(db: Executor, id: number): Promise<ProductRow | undefined> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).for('update');
  return row;
}

interface GalleryEnd {
  /** Position of the first appended image, right after the last one. */
  readonly nextPosition: number;
  readonly hasCover: boolean;
}

type NewImage = Pick<StoredImage, 'key' | 'width' | 'height'>;

async function galleryEnd(db: Executor, productId: number): Promise<GalleryEnd> {
  const [existing] = await db
    .select({ count: count(), last: max(productImages.position) })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  return { nextPosition: existing!.last === null ? 0 : existing!.last + 1, hasCover: existing!.count > 0 };
}

/** Appended rows keep the order sent; the first one becomes the cover of a gallery without one. */
function appendedImageRows(productId: number, images: readonly NewImage[], end: GalleryEnd) {
  return images.map((image, index) => ({
    productId,
    storageKey: image.key,
    width: image.width,
    height: image.height,
    position: end.nextPosition + index,
    isCover: !end.hasCover && index === 0,
  }));
}

export async function insertImages(
  db: Executor,
  productId: number,
  images: readonly NewImage[],
): Promise<void> {
  const end = await galleryEnd(db, productId);
  await db.insert(productImages).values(appendedImageRows(productId, images, end));
}

export async function setImageOrder(db: Executor, productId: number, ids: number[], coverId: number) {
  for (const [position, id] of ids.entries()) {
    await db
      .update(productImages)
      .set({ position, isCover: id === coverId })
      .where(and(eq(productImages.id, id), eq(productImages.productId, productId)));
  }
}

export async function deleteImage(db: Executor, imageId: number): Promise<void> {
  await db.delete(productImages).where(eq(productImages.id, imageId));
}

/** Makes the first image of the gallery the cover (after the cover was removed). */
export async function promoteFirstImage(db: Executor, productId: number): Promise<void> {
  const [next] = await db
    .select({ id: productImages.id })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position), asc(productImages.id))
    .limit(1);
  if (next) await db.update(productImages).set({ isCover: true }).where(eq(productImages.id, next.id));
}

/** Storage keys still referenced by any product image or media row. */
export async function storageKeysInUse(db: Executor, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const [fromProducts, fromMedia] = await Promise.all([
    db
      .selectDistinct({ key: productImages.storageKey })
      .from(productImages)
      .where(inArray(productImages.storageKey, keys)),
    db.selectDistinct({ key: media.storageKey }).from(media).where(inArray(media.storageKey, keys)),
  ]);
  return new Set([...fromProducts, ...fromMedia].map((row) => row.key));
}

// Stock

/**
 * Atomic stock change: applies `delta` only if the result stays non negative and the product
 * meets the extra conditions. Returns the new quantity, or undefined when it did not apply.
 */
async function applyStockDeltaWhere(
  db: Executor,
  productId: number,
  delta: number,
  extraConditions: readonly SQL[],
): Promise<number | undefined> {
  const [row] = await db
    .update(products)
    .set({ stockAvailable: sql`${products.stockAvailable} + ${delta}` })
    .where(
      and(eq(products.id, productId), sql`${products.stockAvailable} + ${delta} >= 0`, ...extraConditions),
    )
    .returning({ stockAvailable: products.stockAvailable });
  return row?.stockAvailable;
}

/** Undefined when the product does not exist or has too little stock. */
export function applyStockDelta(db: Executor, productId: number, delta: number): Promise<number | undefined> {
  return applyStockDeltaWhere(db, productId, delta, []);
}

/** Like `applyStockDelta`, and also undefined when the product is archived. */
export function applyStockDeltaToActive(
  db: Executor,
  productId: number,
  delta: number,
): Promise<number | undefined> {
  return applyStockDeltaWhere(db, productId, delta, [isNull(products.archivedAt)]);
}

export interface NewStockMovement {
  productId: number;
  type: StockMovementType;
  quantity: number;
  reason?: string | null;
  authorId?: number | null;
  orderId?: number | null;
  createdAt: Date;
}

export async function insertMovements(db: Executor, movements: NewStockMovement[]) {
  if (movements.length === 0) return [];
  return db.insert(stockMovements).values(movements).returning();
}

const movementWithAuthor = { ...getTableColumns(stockMovements), authorName: users.name };

function movementsPage(db: Executor, where: SQL, page: PageWindow) {
  return db
    .select(movementWithAuthor)
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.authorId))
    .where(where)
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(page.limit)
    .offset(page.offset);
}

async function countMovements(db: Executor, where: SQL): Promise<number> {
  const [row] = await db.select({ value: count() }).from(stockMovements).where(where);
  return row!.value;
}

/** Newest first, with the author name. */
export async function listMovements(db: Executor, productId: number, page: PageWindow) {
  const where = eq(stockMovements.productId, productId);
  const [rows, total] = await Promise.all([movementsPage(db, where, page), countMovements(db, where)]);
  return { rows, total };
}

export async function findAuthorName(db: Executor, userId: number): Promise<string> {
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return row!.name;
}

/** The store wide minimum stock (store settings), 1 when the store was not configured yet. */
export async function defaultStockMin(db: Executor): Promise<number> {
  const [row] = await db.select({ value: storeSettings.defaultStockMin }).from(storeSettings).limit(1);
  return row!.value;
}

/** The minimum of the product, or the store default when the product has none. */
function effectiveStockMin(storeMin: number): SQL<number> {
  return sql<number>`coalesce(${products.stockMin}, ${storeMin})`;
}

function lowStockItems(db: Executor, below: SQL | undefined, storeMin: number, limit: number) {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      stockAvailable: products.stockAvailable,
      stockMin: effectiveStockMin(storeMin).mapWith(Number),
    })
    .from(products)
    .where(below)
    .orderBy(asc(products.stockAvailable), asc(products.name))
    .limit(limit);
}

/** Active products below their minimum (or the store default), lowest stock first, with the total count. */
export async function lowStockProducts(db: Executor, limit: number) {
  const storeMin = await defaultStockMin(db);
  const below = and(
    isNull(products.archivedAt),
    sql`${products.stockAvailable} < ${effectiveStockMin(storeMin)}`,
  );
  const [items, total] = await Promise.all([
    lowStockItems(db, below, storeMin, limit),
    countProducts(db, below),
  ]);
  return { items, total };
}

export async function countProducts(db: Executor, where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ value: count() }).from(products).where(where);
  return row!.value;
}

export async function findProductsByIds(db: Executor, ids: number[]): Promise<ProductRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}
