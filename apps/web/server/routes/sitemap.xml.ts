import { fetchSitemapProducts, sitemapXml } from '../../app/utils/sitemap';

/** sitemap.xml: the public pages and every product of the catalog (issue #77). */
export default defineEventHandler(async (event) => {
  const products = await fetchSitemapProducts(useRuntimeConfig(event).public.apiBase);
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=3600');
  return sitemapXml(getRequestURL(event).origin, products);
});
