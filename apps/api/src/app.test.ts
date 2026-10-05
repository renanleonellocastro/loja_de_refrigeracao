import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { UndeclaredPermissionError } from './plugins/auth.js';
import { testConfig, useTestApp } from '../test/harness.js';

describe('app', () => {
  const t = useTestApp();

  it('answers the health check', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/health' });
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports readiness when the database answers', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
  });

  it('reports 503 when the database is down', async () => {
    const failingDb = { execute: () => Promise.reject(new Error('down')) } as unknown as typeof t.ctx.db;
    const app = await buildApp({ ...t.ctx, db: failingDb });
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(503);
    await app.close();
  });

  it('publishes the OpenAPI document and the reference page', async () => {
    const spec = await t.app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(spec.json()).toMatchObject({ openapi: '3.1.0', info: { title: 'Refrigeração Castro API' } });
    expect(Object.keys(spec.json().paths)).toContain('/api/v1/auth/sessions');
    const docs = await t.app.inject({ method: 'GET', url: '/api/docs' });
    expect(docs.statusCode).toBeLessThan(400);
  });

  it('answers unknown routes with a problem document', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/api/v1/nada' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ title: 'Não encontrado', instance: '/api/v1/nada' });
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const app = await buildApp(t.ctx);
    app.get('/explode', async () => {
      throw new Error('secret database detail');
    });
    const response = await app.inject({ method: 'GET', url: '/explode' });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret');
    expect(response.json()).toMatchObject({ title: 'Erro interno', requestId: expect.any(String) });
    await app.close();
  });

  it.each([
    [413, 'Arquivo grande demais'],
    [415, 'Tipo não aceito'],
    [400, 'Requisição inválida'],
  ])('maps framework %i errors to problems', async (status, title) => {
    const app = await buildApp(t.ctx);
    app.get('/client-error', async () => {
      throw Object.assign(new Error('nope'), { statusCode: status });
    });
    const response = await app.inject({ method: 'GET', url: '/client-error' });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ title, status });
    await app.close();
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/v1/auth/sessions',
      headers: { 'content-type': 'application/json' },
      payload: '{nope',
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses to register api routes without a declared permission', async () => {
    const app = await buildApp(t.ctx);
    expect(() =>
      app.register(async (api) => {
        api.get('/api/v1/sem-permissao', async () => 'x');
      }),
    ).not.toThrow();
    await expect(app.ready()).rejects.toBeInstanceOf(UndeclaredPermissionError);
  });

  it('sends the security headers on API responses', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeUndefined();
    const docs = await t.app.inject({ method: 'GET', url: '/api/docs' });
    expect(docs.headers['content-security-policy']).toBeUndefined();
  });

  it('sends HSTS in production', async () => {
    const config = testConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'production-secret-for-the-test-0123456789',
      DATABASE_URL: 'postgres://prod/db',
    });
    const app = await buildApp({ ...t.ctx, config: { ...config, LOG_LEVEL: 'silent' } });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
    await app.close();
  });

  it('allows credentialed CORS only for APP_ORIGIN', async () => {
    const preflight = (origin: string) =>
      t.app.inject({
        method: 'OPTIONS',
        url: '/api/v1/auth/sessions',
        headers: { origin, 'access-control-request-method': 'POST' },
      });
    const allowed = await preflight(t.ctx.config.APP_ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(t.ctx.config.APP_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const other = await preflight('https://evil.example');
    // A fixed origin is always echoed back, so the browser refuses any other caller.
    expect(other.headers['access-control-allow-origin']).toBe(t.ctx.config.APP_ORIGIN);
  });

  it('documents error responses as application/problem+json', async () => {
    const spec = (await t.app.inject({ method: 'GET', url: '/api/v1/openapi.json' })).json();
    const login = spec.paths['/api/v1/auth/sessions'].post.responses;
    expect(Object.keys(login['401'].content)).toEqual(['application/problem+json']);
    expect(Object.keys(login['200'].content)).toEqual(['application/json']);
  });

  it.each([
    ['22003', 422],
    ['22021', 422],
    ['XX000', 500],
  ])('maps database error %s to %i without leaking the query', async (code, status) => {
    const app = await buildApp(t.ctx);
    app.get('/db-error', async () => {
      throw new Error('Failed query: insert ... params: secret', {
        cause: Object.assign(new Error('pg'), { code }),
      });
    });
    const response = await app.inject({ method: 'GET', url: '/db-error' });
    expect(response.statusCode).toBe(status);
    expect(response.body).not.toContain('secret');
    await app.close();
  });

  it('logs at the configured level', async () => {
    const app = await buildApp({ ...t.ctx, config: testConfig({ LOG_LEVEL: 'fatal' }) });
    expect(app.log.level).toBe('fatal');
    await app.close();
  });
});
