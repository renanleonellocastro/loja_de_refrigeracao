import type { ApiSchemas } from '@rc/contracts';
import type { LocationQuery, LocationQueryRaw } from 'vue-router';

export type ProductSummary = ApiSchemas['ProductSummary'];
export type ProductDetail = ApiSchemas['ProductDetail'];
export type CatalogFacets = ApiSchemas['CatalogFacets'];
export type Condition = ProductSummary['condition'];
export type CatalogSort = 'relevance' | 'name' | 'newest' | 'priceAsc' | 'priceDesc';

export const CATALOG_PAGE_SIZE = 24;

export const CONDITION_LABELS: Record<Condition, string> = { NEW: 'Novo', USED: 'Usado' };

/** Sort options in Portuguese as they appear in the address (?ordem=menor-preco) and in the select. */
export const SORT_OPTIONS: ReadonlyArray<{ value: string; sort: CatalogSort; label: string }> = [
  { value: 'relevancia', sort: 'relevance', label: 'Mais relevantes' },
  { value: 'recentes', sort: 'newest', label: 'Mais recentes' },
  { value: 'menor-preco', sort: 'priceAsc', label: 'Menor preço' },
  { value: 'maior-preco', sort: 'priceDesc', label: 'Maior preço' },
  { value: 'nome', sort: 'name', label: 'Nome de A a Z' },
];

const CONDITION_PARAMS: Record<string, Condition> = { novo: 'NEW', usado: 'USED' };

/** Filters of the catalog as kept in the address, so a search can be shared and survives the back button. */
export interface CatalogFilters {
  q: string;
  categoryId?: number;
  condition?: Condition;
  brand?: string;
  /** Whole reais, as typed by the person. */
  minPrice?: number;
  maxPrice?: number;
  onlyAvailable: boolean;
  /** Value of SORT_OPTIONS; empty means the default of the API. */
  sort: string;
  page: number;
}

type QueryValue = LocationQuery[string] | undefined;

function text(value: QueryValue): string {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() : '';
}

function positive(value: QueryValue): number | undefined {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Reads the filters from the route query, ignoring anything malformed instead of failing the page. */
export function filtersFromQuery(query: LocationQuery): CatalogFilters {
  const sort = text(query.ordem);
  const categoryId = positive(query.categoria);
  return {
    q: text(query.q).slice(0, 100),
    categoryId: categoryId && categoryId > 0 ? categoryId : undefined,
    condition: CONDITION_PARAMS[text(query.condicao)],
    brand: text(query.marca).slice(0, 60) || undefined,
    minPrice: positive(query.min),
    maxPrice: positive(query.max),
    onlyAvailable: text(query.disponiveis) === '1',
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : '',
    page: Math.max(1, positive(query.pagina) ?? 1),
  };
}

/** Writes the filters back to the address, leaving defaults out so links stay short. */
export function queryFromFilters(filters: CatalogFilters): LocationQueryRaw {
  const query: LocationQueryRaw = {};
  if (filters.q) query.q = filters.q;
  if (filters.categoryId) query.categoria = String(filters.categoryId);
  if (filters.condition) query.condicao = filters.condition === 'NEW' ? 'novo' : 'usado';
  if (filters.brand) query.marca = filters.brand;
  if (filters.minPrice !== undefined) query.min = String(filters.minPrice);
  if (filters.maxPrice !== undefined) query.max = String(filters.maxPrice);
  if (filters.onlyAvailable) query.disponiveis = '1';
  if (filters.sort) query.ordem = filters.sort;
  if (filters.page > 1) query.pagina = String(filters.page);
  return query;
}

/** Query of GET /products/facets: the filters without sort and page. */
export function facetParams(filters: CatalogFilters) {
  return {
    q: filters.q || undefined,
    categoryId: filters.categoryId,
    condition: filters.condition,
    brand: filters.brand,
    minPriceCents: filters.minPrice === undefined ? undefined : filters.minPrice * 100,
    maxPriceCents: filters.maxPrice === undefined ? undefined : filters.maxPrice * 100,
    available: filters.onlyAvailable ? ('true' as const) : undefined,
  };
}

/** Query of GET /products. */
export function productParams(filters: CatalogFilters) {
  const sort = SORT_OPTIONS.find((option) => option.value === filters.sort)?.sort;
  return { ...facetParams(filters), sort, page: filters.page, pageSize: CATALOG_PAGE_SIZE };
}

/** How many filters narrow the list, for the "Filtros (2)" button on phones. Search and sort do not count. */
export function activeFilterCount(filters: CatalogFilters): number {
  return [
    filters.categoryId,
    filters.condition,
    filters.brand,
    filters.minPrice ?? filters.maxPrice,
    filters.onlyAvailable || undefined,
  ].filter((value) => value !== undefined).length;
}

/** Media paths of the API are relative to its origin; the site may run on another one. */
export function mediaUrl(base: string, path: string): string {
  return /^https?:\/\//.test(path) ? path : `${base.replace(/\/$/, '')}${path}`;
}

/** Same as mediaUrl for every candidate of a srcset ("/a/320.webp 320w, /a/640.webp 640w"). */
export function mediaSrcset(base: string, srcset: string): string {
  return srcset
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => {
      const [path, descriptor] = candidate.split(/\s+/);
      return [mediaUrl(base, path!), descriptor].filter(Boolean).join(' ');
    })
    .join(', ');
}

/** "3 produtos" or "1 produto". */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
