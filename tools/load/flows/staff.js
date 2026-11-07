// Store manager: dashboard, order queue with counts, an order, product search and edit, and a counter sale.
import { sleep } from 'k6';
import { idempotencyKey, pick, read, write } from '../api.js';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

/** Search text for one of the load customers (carga-1 to carga-500 in scripts/load-volume.sql). */
function loadCustomerSearch() {
  return encodeURIComponent(`carga ${1 + Math.floor(Math.random() * 500)}`);
}

function reviewOrders(token) {
  const queue =
    read('GET /orders (queue)', '/orders?status=PENDING_REVIEW&pageSize=20', token).json('data') || [];
  read('GET /orders?q', `/orders?q=${loadCustomerSearch()}&pageSize=20`, token);
  if (queue.length > 0) read('GET /orders/:id', `/orders/${pick(queue).id}`, token);
}

function editProduct(token, productIds) {
  const id = pick(productIds);
  const product = read('GET /products/:id', `/products/${id}`, token);
  const headers = { 'if-match': product.headers.Etag };
  const body = { priceCents: 5000 + Math.floor(Math.random() * 500000) };
  write(
    'PATCH /products/:id',
    { method: 'PATCH', path: `/products/${id}`, body, status: 200, headers },
    token,
  );
}

function counterSale(token, fixtures) {
  const items = [{ productId: pick(fixtures.productIds), quantity: 1 }];
  const body = { customerId: pick(fixtures.customerIds), items };
  const headers = { 'idempotency-key': idempotencyKey() };
  write('POST /counter-sales', { method: 'POST', path: '/counter-sales', body, status: 201, headers }, token);
}

/** fixtures: ids of sellable products and of load customers, collected once in the setup. */
function manageCatalog(token, own) {
  read('GET /products (staff)', '/products?includeArchived=true&q=mod-1&pageSize=20', token);
  editProduct(token, own.productIds);
  sleep(1);
  read('GET /users?q', `/users?role=CLIENT&q=${loadCustomerSearch()}`, token);
  counterSale(token, own);
}

// Each staff VU edits and sells only its own slice of products, so two VUs never race on the same ETag
// (a 412 there is the right answer, not a failure of the store).
function ownSlice(productIds) {
  return productIds.filter((_, index) => index % 50 === __VU % 50);
}

export function staff(token, fixtures) {
  const own = { ...fixtures, productIds: ownSlice(fixtures.productIds) };
  read('GET /dashboard', '/dashboard', token);
  sleep(1);
  reviewOrders(token);
  sleep(1);
  manageCatalog(token, own);
  read('GET /service-requests', '/service-requests?pageSize=20', token);
  read('GET /appointments', `/appointments?from=${today()}&to=${inDays(7)}`, token);
  sleep(1);
}
