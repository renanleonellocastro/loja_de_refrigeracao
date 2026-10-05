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
  '/produtos/gerenciar',
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

/** Every product of the public catalog, page by page; an unreachable API yields the static pages only. */
export async function fetchSitemapProducts(
  apiBase: string,
  fetcher: typeof fetch = fetch,
): Promise<SitemapProduct[]> {
  const products: SitemapProduct[] = [];
  try {
    for (let page = 1; ; page += 1) {
      const response = await fetcher(
        `${apiBase}/api/v1/products?page=${page}&pageSize=${SITEMAP_PAGE_SIZE}&sort=name`,
      );
      if (!response.ok) break;
      const body = (await response.json()) as { data: SitemapProduct[]; meta: { total: number } };
      products.push(...body.data.map(({ slug }) => ({ slug })));
      if (page * SITEMAP_PAGE_SIZE >= body.meta.total) break;
    }
  } catch {
    // The sitemap still lists the static pages.
  }
  return products;
}
