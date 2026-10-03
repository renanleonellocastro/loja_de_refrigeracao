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

  it('logs at the configured level', async () => {
    const app = await buildApp({ ...t.ctx, config: testConfig({ LOG_LEVEL: 'fatal' }) });
    expect(app.log.level).toBe('fatal');
    await app.close();
  });
});
