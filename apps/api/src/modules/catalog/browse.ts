import type { Executor } from '../../infra/db/client.js';
import { pageOf, toLimitOffset } from '../../shared/pagination.js';
import { normalizeText } from '../../shared/text.js';
import * as repo from './repository.js';
import type { CatalogFilters, ProductListQuery } from './schemas.js';
import { toSummary } from './views.js';

/** Archived products only appear for the staff that asks for them. */
function searchOf(filters: CatalogFilters, staff: boolean): repo.CatalogSearch {
  const q = filters.q === undefined ? '' : normalizeText(filters.q);
  return {
    q: q === '' ? undefined : q,
    categoryId: filters.categoryId,
    condition: filters.condition,
    brand: filters.brand,
    minPriceCents: filters.minPriceCents,
    maxPriceCents: filters.maxPriceCents,
    available: filters.available,
    includeArchived: staff && filters.includeArchived === true,
  };
}

/** UC Consultar Produtos: typo and accent tolerant search, filters, sorting and pagination. */
export async function listProducts(db: Executor, query: ProductListQuery, staff: boolean) {
  const search = searchOf(query, staff);
  const sort = query.sort ?? (search.q ? 'relevance' : 'newest');
  const { rows, total } = await repo.searchProducts(db, search, sort, toLimitOffset(query));
  const [covers, storeMin] = await Promise.all([
    repo.coversOf(
      db,
      rows.map((row) => row.id),
    ),
    repo.defaultStockMin(db),
  ]);
  const coverOf = new Map(covers.map((cover) => [cover.productId, cover]));
  return pageOf(
    rows.map((row) => toSummary(row, coverOf.get(row.id), storeMin)),
    query,
    total,
  );
}

/** Counts for the filter drawer; each facet ignores its own filter so alternatives stay visible. */
export async function productFacets(db: Executor, filters: CatalogFilters, staff: boolean) {
  return repo.catalogFacets(db, searchOf(filters, staff));
}
