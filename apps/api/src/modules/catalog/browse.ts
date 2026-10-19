import type { Executor } from '../../infra/db/client.js';
import { pageOf, toLimitOffset } from '../../shared/pagination.js';
import { normalizeText } from '../../shared/text.js';
import * as repo from './repository.js';
import type { CatalogFilters, ProductListQuery } from './schemas.js';
import { catalogFacets, searchProducts, type CatalogSearch } from './search-repository.js';
import { toSummary } from './views.js';

/** Archived products only appear for the staff that asks for them. */
function searchOf(filters: CatalogFilters, staff: boolean): CatalogSearch {
  const normalizedQuery = filters.q === undefined ? '' : normalizeText(filters.q);
  return {
    q: normalizedQuery === '' ? undefined : normalizedQuery,
    categoryId: filters.categoryId,
    condition: filters.condition,
    brand: filters.brand,
    minPriceCents: filters.minPriceCents,
    maxPriceCents: filters.maxPriceCents,
    available: filters.available,
    includeArchived: staff && filters.includeArchived === true,
  };
}

async function summariesOf(db: Executor, rows: repo.ProductWithCategory[]) {
  const productIds = rows.map((row) => row.id);
  const [covers, storeMin] = await Promise.all([repo.coversOf(db, productIds), repo.defaultStockMin(db)]);
  const coverOf = new Map(covers.map((cover) => [cover.productId, cover]));
  return rows.map((row) => toSummary(row, coverOf.get(row.id), storeMin));
}

/** UC Consultar Produtos: typo and accent tolerant search, filters, sorting and pagination. */
export async function listProducts(db: Executor, query: ProductListQuery, staff: boolean) {
  const search = searchOf(query, staff);
  const sort = query.sort ?? (search.q ? 'relevance' : 'newest');
  const { rows, total } = await searchProducts(db, search, sort, toLimitOffset(query));
  return pageOf(await summariesOf(db, rows), query, total);
}

/** Counts for the filter drawer; each facet ignores its own filter so alternatives stay visible. */
export async function productFacets(db: Executor, filters: CatalogFilters, staff: boolean) {
  return catalogFacets(db, searchOf(filters, staff));
}
