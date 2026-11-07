// Thin HTTP helpers shared by the k6 flows: every request carries a stable name and its kind (read or write),
// so the thresholds of RNF-10 apply per kind and the report groups by endpoint instead of by URL.
import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = (__ENV.LOAD_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;

function params(name, kind, token, headers = {}) {
  const auth = token ? { authorization: `Bearer ${token}` } : {};
  return {
    headers: { 'content-type': 'application/json', ...auth, ...headers },
    tags: { name, kind },
  };
}

function expectStatus(response, name, status) {
  check(response, { [`${name} ${status}`]: (r) => r.status === status });
  return response;
}

export function read(name, path, token) {
  return expectStatus(http.get(`${API}${path}`, params(name, 'read', token)), name, 200);
}

/** A write: method, body and the status it must answer. */
export function write(name, request, token) {
  const { method, path, body, status, headers } = request;
  const response = http.request(
    method,
    `${API}${path}`,
    JSON.stringify(body),
    params(name, 'write', token, headers),
  );
  return expectStatus(response, name, status);
}

export function signIn(email, password) {
  const response = http.post(`${API}/auth/sessions`, JSON.stringify({ email, password }), {
    headers: { 'content-type': 'application/json' },
    tags: { name: 'POST /auth/sessions', kind: 'setup' },
  });
  if (response.status !== 200)
    throw new Error(`Sign in failed for ${email}: ${response.status} ${response.body}`);
  return response.json('accessToken');
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function idempotencyKey() {
  return `k6-${__VU}-${__ITER}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
