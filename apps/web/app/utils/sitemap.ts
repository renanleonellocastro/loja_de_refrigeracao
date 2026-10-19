import { PRIVATE_ROUTES } from './routes';

/** Public pages worth indexing, besides the product pages. */
export const SITEMAP_PAGES = ['/', '/produtos', '/servicos', '/sobre', '/contato', '/privacidade'] as const;

/** Signed in areas, sign in flows and the design guide stay out of search engines. */
export const ROBOTS_DISALLOW = [
  ...PRIVATE_ROUTES,
  '/design',
  '/entrar',
  '/criar-conta',
  '/esqueci-minha-senha',
  '/definir-senha',
  '/redefinir-senha',
  '/confirmar-email',
];

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SitemapProduct {
  slug: string;
}

/** sitemap.xml with the static public pages and one entry per product. */
export function sitemapXml(origin: string, products: SitemapProduct[]): string {
  const paths = [...SITEMAP_PAGES, ...products.map((product) => `/produtos/${product.slug}`)];
  const urls = paths.map((path) => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    ...ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

const SITEMAP_PAGE_SIZE = 100;

interface ProductPage {
  data: SitemapProduct[];
  meta: { total: number };
}

function productPageUrl(apiBase: string, page: number): string {
  return `${apiBase}/api/v1/products?page=${page}&pageSize=${SITEMAP_PAGE_SIZE}&sort=name`;
}

/** One page of the catalog, or null when the API refuses it. */
async function fetchProductPage(
  apiBase: string,
  page: number,
  fetcher: typeof fetch,
): Promise<ProductPage | null> {
  const response = await fetcher(productPageUrl(apiBase, page));
  return response.ok ? ((await response.json()) as ProductPage) : null;
}

/** Appends every page to `products`, so a failure halfway keeps the pages read until then. */
async function collectProducts(
  apiBase: string,
  fetcher: typeof fetch,
  products: SitemapProduct[],
): Promise<void> {
  for (let page = 1; ; page += 1) {
    const body = await fetchProductPage(apiBase, page, fetcher);
    if (!body) return;
    products.push(...body.data.map(({ slug }) => ({ slug })));
    if (page * SITEMAP_PAGE_SIZE >= body.meta.total) return;
  }
}

/** Every product of the public catalog, page by page; an unreachable API yields the static pages only. */
export async function fetchSitemapProducts(
  apiBase: string,
  fetcher: typeof fetch = fetch,
): Promise<SitemapProduct[]> {
  const products: SitemapProduct[] = [];
  try {
    await collectProducts(apiBase, fetcher, products);
  } catch {
    // The sitemap still lists the static pages.
  }
  return products;
}
