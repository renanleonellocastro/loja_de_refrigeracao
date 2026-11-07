// Signed in customer: searches, adds a product to the cart, places the order and follows it in "Meus pedidos".
import { sleep } from 'k6';
import { idempotencyKey, pick, read, write } from '../api.js';

function anAvailableProduct(token) {
  const page = 1 + Math.floor(Math.random() * 300);
  const path = `/products?available=true&pageSize=24&page=${page}`;
  return pick(read('GET /products?available', path, token).json('data') || []);
}

function addToCart(token) {
  const product = anAvailableProduct(token);
  read('GET /products/:slug', `/products/${product.slug}`, token);
  sleep(1);
  const request = { method: 'PUT', path: `/me/cart/items/${product.id}`, body: { quantity: 1 }, status: 200 };
  write('PUT /me/cart/items/:productId', request, token);
  read('GET /me/cart', '/me/cart', token);
}

function placeOrder(token) {
  const headers = { 'idempotency-key': idempotencyKey() };
  return write('POST /orders', { method: 'POST', path: '/orders', body: {}, status: 201, headers }, token);
}

export function customer(token) {
  addToCart(token);
  sleep(1);
  const order = placeOrder(token);
  sleep(1);
  read('GET /orders (mine)', '/orders?pageSize=20', token);
  if (order.status === 201) read('GET /orders/:id', `/orders/${order.json('id')}`, token);
  sleep(1);
}
