import { and, asc, count, desc, eq, gte, isNotNull, isNull, lte, max, min, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { categories, products } from '../../infra/db/schema.js';
import { countProducts, productWithCategory, type PageWindow } from './repository.js';
import type { ProductCondition, ProductSort } from './schemas.js';

/** Minimum word similarity (pg_trgm) for a search term to match despite typos. */
export const TYPO_SIMILARITY = 0.5;

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

/** One filter of the catalog search; the ones tied to a facet are left out when counting that facet. */
interface SearchFilter {
  readonly facet?: FacetKey;
  conditions(search: CatalogSearch): SQL[];
}

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

function priceConditions(search: CatalogSearch): SQL[] {
  return [
    ...(search.minPriceCents === undefined ? [] : [gte(products.priceCents, search.minPriceCents)]),
    ...(search.maxPriceCents === undefined ? [] : [lte(products.priceCents, search.maxPriceCents)]),
  ];
}

function availabilityConditions(search: CatalogSearch): SQL[] {
  if (search.available === undefined) return [];
  return [search.available ? sql`${products.stockAvailable} > 0` : eq(products.stockAvailable, 0)];
}

/** In the order the conditions appear in the query. */
const SEARCH_FILTERS: readonly SearchFilter[] = [
  { conditions: (search) => textConditions(search.q) },
  { conditions: (search) => (search.includeArchived ? [] : [isNull(products.archivedAt)]) },
  {
    facet: 'categoryId',
    conditions: (search) =>
      search.categoryId === undefined ? [] : [eq(products.categoryId, search.categoryId)],
  },
  {
    facet: 'condition',
    conditions: (search) => (search.condition ? [eq(products.condition, search.condition)] : []),
  },
  {
    facet: 'brand',
    conditions: (search) =>
      search.brand ? [sql`lower(${products.brand}) = ${search.brand.toLowerCase()}`] : [],
  },
  { facet: 'price', conditions: priceConditions },
  { facet: 'available', conditions: availabilityConditions },
];

function appliesTo(filter: SearchFilter, ignoredFacet: FacetKey | undefined): boolean {
  return filter.facet === undefined || filter.facet !== ignoredFacet;
}

function catalogConditions(search: CatalogSearch, ignoredFacet?: FacetKey): SQL[] {
  return SEARCH_FILTERS.filter((filter) => appliesTo(filter, ignoredFacet)).flatMap((filter) =>
    filter.conditions(search),
  );
}

function relevanceOf(q: string): SQL<number> {
  const phrase = stripWildcards(q);
  return sql<number>`(word_similarity(${phrase}::text, ${products.searchText})
    + case when ${products.searchText} like ${`%${phrase}%`} then 1 else 0 end
    + case when ${products.searchText} like ${`${phrase}%`} then 0.5 else 0 end)`;
}

const byName = (): SQL[] => [asc(products.name), asc(products.id)];
const newestFirst = (): SQL[] => [desc(products.createdAt), desc(products.id)];

/** Each sort with its tie breakers, so pages never repeat or skip a product. */
const SORT_ORDERS: Record<ProductSort, (q: string | undefined) => SQL[]> = {
  relevance: (q) => (q ? [desc(relevanceOf(q)), ...byName()] : newestFirst()),
  name: byName,
  priceAsc: () => [asc(products.priceCents), ...byName()],
  priceDesc: () => [desc(products.priceCents), ...byName()],
  newest: newestFirst,
};

function productsPage(db: Executor, where: SQL | undefined, order: SQL[], page: PageWindow) {
  return db
    .select(productWithCategory)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(...order)
    .limit(page.limit)
    .offset(page.offset);
}

export async function searchProducts(
  db: Executor,
  search: CatalogSearch,
  sort: ProductSort,
  page: PageWindow,
) {
  const where = and(...catalogConditions(search));
  const order = SORT_ORDERS[sort](search.q);
  const [rows, total] = await Promise.all([productsPage(db, where, order, page), countProducts(db, where)]);
  return { rows, total };
}

function brandFacet(db: Executor, where: SQL | undefined) {
  return (
    db
      // Brands typed with different case are one brand (the filter ignores case too).
      .select({ brand: sql<string>`min(${products.brand})`, count: count() })
      .from(products)
      .where(and(where, isNotNull(products.brand)))
      .groupBy(sql`lower(${products.brand})`)
      .orderBy(desc(count()), sql`lower(${products.brand})`)
  );
}

function categoryFacet(db: Executor, where: SQL | undefined) {
  return db
    .select({ categoryId: categories.id, name: categories.name, count: count() })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.name));
}

function conditionFacet(db: Executor, where: SQL | undefined) {
  return db
    .select({ condition: products.condition, count: count() })
    .from(products)
    .where(where)
    .groupBy(products.condition)
    .orderBy(asc(products.condition));
}

/** The price range of the matching products, or null when none matches. */
async function priceFacet(db: Executor, where: SQL | undefined) {
  const [range] = await db
    .select({ minCents: min(products.priceCents), maxCents: max(products.priceCents) })
    .from(products)
    .where(where);
  if (range!.minCents === null || range!.maxCents === null) return null;
  return { minCents: range!.minCents, maxCents: range!.maxCents };
}

async function availabilityFacet(db: Executor, where: SQL | undefined) {
  const [availability] = await db
    .select({
      available: sql<number>`count(*) filter (where ${products.stockAvailable} > 0)`.mapWith(Number),
      unavailable: sql<number>`count(*) filter (where ${products.stockAvailable} = 0)`.mapWith(Number),
    })
    .from(products)
    .where(where);
  return availability!;
}

/** Counts for the filter drawer; each facet ignores its own filter so alternatives stay visible. */
export async function catalogFacets(db: Executor, search: CatalogSearch) {
  const whereWithout = (facet: FacetKey) => and(...catalogConditions(search, facet));
  const [brands, byCategory, byCondition, price, availability] = await Promise.all([
    brandFacet(db, whereWithout('brand')),
    categoryFacet(db, whereWithout('categoryId')),
    conditionFacet(db, whereWithout('condition')),
    priceFacet(db, whereWithout('price')),
    availabilityFacet(db, whereWithout('available')),
  ]);
  return { brands, categories: byCategory, conditions: byCondition, price, availability };
}
