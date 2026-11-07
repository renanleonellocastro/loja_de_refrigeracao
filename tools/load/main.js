// k6 load test of RNF-10 (docs/REQUISITOS.md, docs/TESTES.md): 50 simultaneous users split into visitors,
// customers and the store staff, against the API loaded with 10 thousand products and 50 thousand orders.
// Run with `make load`; LOAD_BASE_URL, LOAD_DURATION and LOAD_SUMMARY tune it.
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { read, signIn } from './api.js';
import { customer } from './flows/customer.js';
import { staff } from './flows/staff.js';
import { visitor } from './flows/visitor.js';

const PASSWORD = __ENV.LOAD_PASSWORD || 'Castro-Dev-2026';
const DURATION = __ENV.LOAD_DURATION || '3m';
const USERS = { visitor: 30, customer: 14, staff: 6 };

function scenario(exec, vus) {
  return {
    executor: 'ramping-vus',
    exec,
    startVUs: 0,
    stages: [
      { duration: '30s', target: vus },
      { duration: DURATION, target: vus },
      { duration: '15s', target: 0 },
    ],
    gracefulRampDown: '10s',
  };
}

// Every endpoint gets its own threshold, so the report lists the p95 of each one (docs/TESTES.md).
const READS = [
  'GET /store',
  'GET /categories',
  'GET /products?categoryId',
  'GET /products/facets',
  'GET /products?q',
  'GET /products?available',
  'GET /products/:slug',
  'GET /service-types',
  'GET /me/cart',
  'GET /orders (mine)',
  'GET /orders/:id',
  'GET /dashboard',
  'GET /orders (queue)',
  'GET /orders?q',
  'GET /products (staff)',
  'GET /products/:id',
  'GET /users?q',
  'GET /service-requests',
  'GET /appointments',
];
const WRITES = [
  'PUT /me/cart/items/:productId',
  'POST /orders',
  'PATCH /products/:id',
  'POST /counter-sales',
];

function perEndpoint(names, limit) {
  return Object.fromEntries(names.map((name) => [`http_req_duration{name:${name}}`, [`p(95)<${limit}`]]));
}

export const options = {
  scenarios: {
    visitors: scenario('visitorFlow', USERS.visitor),
    customers: scenario('customerFlow', USERS.customer),
    staff: scenario('staffFlow', USERS.staff),
  },
  thresholds: {
    'http_req_duration{kind:read}': ['p(95)<150'],
    'http_req_duration{kind:write}': ['p(95)<300'],
    'http_req_failed{kind:read}': ['rate<0.01'],
    'http_req_failed{kind:write}': ['rate<0.01'],
    checks: ['rate>0.99'],
    ...perEndpoint(READS, 150),
    ...perEndpoint(WRITES, 300),
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  setupTimeout: '2m',
};

function ids(path, token) {
  return (read('setup', path, token).json('data') || []).map((row) => row.id);
}

function collectFixtures(token) {
  const productIds = [];
  for (let page = 1; page <= 5; page += 1) {
    productIds.push(
      ...ids(`/products?q=produto%20de%20carga&available=true&pageSize=100&page=${page}`, token),
    );
  }
  return { productIds, customerIds: ids('/users?role=CLIENT&q=carga&pageSize=100', token) };
}

/** The manager signs in once before the load starts: the flows measure the store, not the password hash. */
export function setup() {
  const managerToken = signIn('gerente@castro.dev', PASSWORD);
  return { managerToken, fixtures: collectFixtures(managerToken) };
}

// Each customer VU signs in once with its own account (carga-<VU>), so no two VUs share a cart.
let customerToken;

export function visitorFlow() {
  visitor();
}

export function customerFlow() {
  customerToken = customerToken || signIn(`carga-${__VU}@castro.dev`, PASSWORD);
  customer(customerToken);
}

export function staffFlow(data) {
  staff(data.managerToken, data.fixtures);
}

export function handleSummary(data) {
  const report = { stdout: textSummary(data, { indent: ' ', enableColors: true }) };
  if (__ENV.LOAD_SUMMARY) report[__ENV.LOAD_SUMMARY] = JSON.stringify(data, null, 2);
  return report;
}
