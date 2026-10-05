import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  min,
  sql,
  type SQL,
} from 'drizzle-orm';
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
import type { ProductCondition, ProductSort } from './schemas.js';

export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;
export type StockMovementRow = typeof stockMovements.$inferSelect;
export type StockMovementType = StockMovementRow['type'];
export type ProductWithCategory = ProductRow & { categoryName: string };

/** Minimum word similarity (pg_trgm) for a search term to match despite typos. */
export const TYPO_SIMILARITY = 0.5;

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

const productWithCategory = { ...getTableColumns(products), categoryName: categories.name };

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

// Catalog search

export interface CatalogSearch {
  /** Search text already normalized (lowercase, no accents). */
  q?: string | undefined;
  categoryId?: number | undefined;
  condition?: ProductCondition | undefined;
  brand?: string | undefined;
  minPriceCents?: number | undefined;
  maxPriceCents?: number | undefined;
  available?: boolean | undefined;
  includeArchived: boolean;
}

/** Filters a facet ignores, so the shopper sees the alternatives to the current choice. */
type FacetKey = 'categoryId' | 'condition' | 'brand' | 'price' | 'available';

function stripWildcards(value: string): string {
  return value.replace(/[%_\\]/g, '');
}

function textConditions(q: string | undefined): SQL[] {
  const terms = stripWildcards(q ?? '')
    .split(' ')
    .filter((term) => term !== '');
  // Every term must appear, exactly or with a typo (word similarity of pg_trgm).
  return terms.map(
    (term) =>
      sql`(${products.searchText} like ${`%${term}%`} or word_similarity(${term}::text, ${products.searchText}) >= ${TYPO_SIMILARITY})`,
  );
}

function catalogConditions(search: CatalogSearch, ignore?: FacetKey): SQL[] {
  const conditions = textConditions(search.q);
  if (!search.includeArchived) conditions.push(isNull(products.archivedAt));
  if (search.categoryId !== undefined && ignore !== 'categoryId') {
    conditions.push(eq(products.categoryId, search.categoryId));
  }
  if (search.condition && ignore !== 'condition') conditions.push(eq(products.condition, search.condition));
  if (search.brand && ignore !== 'brand') {
    conditions.push(sql`lower(${products.brand}) = ${search.brand.toLowerCase()}`);
  }
  if (ignore !== 'price') {
    if (search.minPriceCents !== undefined) conditions.push(gte(products.priceCents, search.minPriceCents));
    if (search.maxPriceCents !== undefined) conditions.push(lte(products.priceCents, search.maxPriceCents));
  }
  if (search.available !== undefined && ignore !== 'available') {
    conditions.push(search.available ? sql`${products.stockAvailable} > 0` : eq(products.stockAvailable, 0));
  }
  return conditions;
}

function relevanceOf(q: string): SQL<number> {
  const phrase = stripWildcards(q);
  return sql<number>`(word_similarity(${phrase}::text, ${products.searchText})
    + case when ${products.searchText} like ${`%${phrase}%`} then 1 else 0 end
    + case when ${products.searchText} like ${`${phrase}%`} then 0.5 else 0 end)`;
}

function orderFor(sort: ProductSort, q: string | undefined): SQL[] {
  switch (sort) {
    case 'relevance':
      return q
        ? [desc(relevanceOf(q)), asc(products.name), asc(products.id)]
        : [desc(products.createdAt), desc(products.id)];
    case 'name':
      return [asc(products.name), asc(products.id)];
    case 'priceAsc':
      return [asc(products.priceCents), asc(products.name), asc(products.id)];
    case 'priceDesc':
      return [desc(products.priceCents), asc(products.name), asc(products.id)];
    case 'newest':
      return [desc(products.createdAt), desc(products.id)];
  }
}

export async function searchProducts(
  db: Executor,
  search: CatalogSearch,
  sort: ProductSort,
  page: { limit: number; offset: number },
) {
  const where = and(...catalogConditions(search));
  const [rows, totals] = await Promise.all([
    db
      .select(productWithCategory)
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .orderBy(...orderFor(sort, search.q))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ value: count() }).from(products).where(where),
  ]);
  return { rows, total: totals[0]!.value };
}

export async function catalogFacets(db: Executor, search: CatalogSearch) {
  const whereWithout = (key: FacetKey) => and(...catalogConditions(search, key));
  const [brands, byCategory, byCondition, prices, availability] = await Promise.all([
    db
      // Brands typed with different case are one brand (the filter ignores case too).
      .select({ brand: sql<string>`min(${products.brand})`, count: count() })
      .from(products)
      .where(and(whereWithout('brand'), isNotNull(products.brand)))
      .groupBy(sql`lower(${products.brand})`)
      .orderBy(desc(count()), sql`lower(${products.brand})`),
    db
      .select({ categoryId: categories.id, name: categories.name, count: count() })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(whereWithout('categoryId'))
      .groupBy(categories.id)
      .orderBy(asc(categories.position), asc(categories.name)),
    db
      .select({ condition: products.condition, count: count() })
      .from(products)
      .where(whereWithout('condition'))
      .groupBy(products.condition)
      .orderBy(asc(products.condition)),
    db
      .select({ minCents: min(products.priceCents), maxCents: max(products.priceCents) })
      .from(products)
      .where(whereWithout('price')),
    db
      .select({
        available: sql<number>`count(*) filter (where ${products.stockAvailable} > 0)`.mapWith(Number),
        unavailable: sql<number>`count(*) filter (where ${products.stockAvailable} = 0)`.mapWith(Number),
      })
      .from(products)
      .where(whereWithout('available')),
  ]);
  const range = prices[0]!;
  return {
    brands,
    categories: byCategory,
    conditions: byCondition,
    price:
      range.minCents === null || range.maxCents === null
        ? null
        : { minCents: range.minCents, maxCents: range.maxCents },
    availability: availability[0]!,
  };
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

export async function insertImages(
  db: Executor,
  productId: number,
  images: Array<{ key: string; width: number; height: number }>,
): Promise<void> {
  const existing = await db
    .select({ count: count(), last: max(productImages.position) })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  const first = existing[0]!.last === null ? 0 : existing[0]!.last + 1;
  const hasCover = existing[0]!.count > 0;
  await db.insert(productImages).values(
    images.map((image, index) => ({
      productId,
      storageKey: image.key,
      width: image.width,
      height: image.height,
      position: first + index,
      isCover: !hasCover && index === 0,
    })),
  );
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
 * Atomic stock change: applies `delta` only if the result stays non negative.
 * Returns the new quantity, or undefined when the product does not exist, is archived
 * (when `activeOnly`), or has too little stock.
 */
export async function applyStockDelta(
  db: Executor,
  productId: number,
  delta: number,
  activeOnly = false,
): Promise<number | undefined> {
  const conditions = [
    eq(products.id, productId),
    sql`${products.stockAvailable} + ${delta} >= 0`,
    ...(activeOnly ? [isNull(products.archivedAt)] : []),
  ];
  const [row] = await db
    .update(products)
    .set({ stockAvailable: sql`${products.stockAvailable} + ${delta}` })
    .where(and(...conditions))
    .returning({ stockAvailable: products.stockAvailable });
  return row?.stockAvailable;
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

export async function listMovements(
  db: Executor,
  productId: number,
  page: { limit: number; offset: number },
) {
  const where = eq(stockMovements.productId, productId);
  const [rows, totals] = await Promise.all([
    db
      .select(movementWithAuthor)
      .from(stockMovements)
      .leftJoin(users, eq(users.id, stockMovements.authorId))
      .where(where)
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ value: count() }).from(stockMovements).where(where),
  ]);
  return { rows, total: totals[0]!.value };
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

/** Active products below their minimum (or the store default), lowest stock first, with the total count. */
export async function lowStockProducts(db: Executor, limit: number) {
  const storeMin = await defaultStockMin(db);
  const below = and(
    isNull(products.archivedAt),
    sql`${products.stockAvailable} < coalesce(${products.stockMin}, ${storeMin})`,
  );
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        stockAvailable: products.stockAvailable,
        stockMin: sql<number>`coalesce(${products.stockMin}, ${storeMin})`.mapWith(Number),
      })
      .from(products)
      .where(below)
      .orderBy(asc(products.stockAvailable), asc(products.name))
      .limit(limit),
    db.select({ value: count() }).from(products).where(below),
  ]);
  return { items, total: total!.value };
}

export async function findProductsByIds(db: Executor, ids: number[]): Promise<ProductRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}
