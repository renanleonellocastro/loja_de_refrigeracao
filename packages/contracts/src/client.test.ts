import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client.js';

function fakeFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const request = input as Request;
    const body = JSON.stringify({
      accessToken: 't',
      expiresIn: 900,
      user: { id: 1, name: 'A', email: 'a@b.c', role: 'CLIENT' },
    });
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-url': request.url },
    });
  });
}

describe('createApiClient', () => {
  it('calls typed paths on the base url with credentials', async () => {
    const fetch = fakeFetch();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });
    const { data } = await client.POST('/api/v1/auth/sessions', { body: { email: 'a@b.c', password: 'x' } });
    expect(data?.user.role).toBe('CLIENT');
    const request = fetch.mock.calls[0]![0] as Request;
    expect(request.url).toBe('http://api.test/api/v1/auth/sessions');
    expect(request.credentials).toBe('include');
    expect(request.headers.get('authorization')).toBeNull();
  });

  it('adds the bearer token when one is available', async () => {
    const fetch = fakeFetch();
    const client = createApiClient({ baseUrl: 'http://api.test', fetch, getAccessToken: () => 'abc' });
    await client.GET('/api/v1/audit-logs', { params: { query: {} } });
    expect((fetch.mock.calls[0]![0] as Request).headers.get('authorization')).toBe('Bearer abc');
  });

  it('works with the global fetch by default', () => {
    expect(createApiClient({ baseUrl: 'http://api.test' })).toHaveProperty('GET');
  });
});
