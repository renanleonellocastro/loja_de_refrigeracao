// Anonymous visitor: home, catalog with search and filters, a product page and the service list.
import { sleep } from 'k6';
import { pick, read } from '../api.js';

const SEARCHES = ['geladeira', 'consul', 'brastemp', 'produto de carga 12', 'mod-77', 'freezer'];
const SORTS = ['relevance', 'newest', 'priceAsc', 'priceDesc', 'name'];

function browseCatalog() {
  const category = 1 + Math.floor(Math.random() * 7);
  read('GET /products?categoryId', `/products?categoryId=${category}&sort=${pick(SORTS)}&pageSize=24`);
  read('GET /products/facets', `/products/facets?categoryId=${category}`);
  sleep(1);
  return read('GET /products?q', `/products?q=${encodeURIComponent(pick(SEARCHES))}&pageSize=24`);
}

export function visitor() {
  read('GET /store', '/store');
  read('GET /categories', '/categories');
  sleep(1);
  const products = browseCatalog().json('data') || [];
  sleep(1);
  if (products.length > 0) read('GET /products/:slug', `/products/${pick(products).slug}`);
  read('GET /service-types', '/service-types');
  sleep(1);
}
