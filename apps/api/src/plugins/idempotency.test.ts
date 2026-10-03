import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { useTestApp } from '../../test/harness.js';

describe('Idempotency-Key', () => {
  const t = useTestApp();
  let app: FastifyInstance;
  let calls = 0;

  beforeAll(async () => {
    app = await buildApp(t.ctx);
    app.post('/idem', { config: { idempotent: true } }, async (_request, reply) => {
      calls += 1;
      return reply.code(201).send({ call: calls });
    });
    app.post('/idem-fail', { config: { idempotent: true } }, async () => {
      throw new Error('boom');
    });
    app.post('/idem-stream', { config: { idempotent: true } }, async (_request, reply) =>
      reply.send(Readable.from(['x'])),
    );
    await app.ready();
  });

  afterAll(() => app.close());

  const post = (url: string, headers: Record<string, string>, payload: unknown = { a: 1 }) =>
    app.inject({ method: 'POST', url, headers, payload: payload as object });

  it('replays the first response for a repeated key', async () => {
    const { headers } = await t.as('CLIENT');
    const first = await post('/idem', { ...headers, 'idempotency-key': 'pedido-123456' });
    const second = await post('/idem', { ...headers, 'idempotency-key': 'pedido-123456' });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(second.headers['idempotent-replayed']).toBe('true');
  });

  it('hashes requests without a body', async () => {
    const { headers } = await t.as('CLIENT');
    const h = { ...headers, 'idempotency-key': 'sem-corpo-123' };
    await app.inject({ method: 'POST', url: '/idem', headers: h });
    const again = await app.inject({ method: 'POST', url: '/idem', headers: h });
    expect(again.headers['idempotent-replayed']).toBe('true');
  });

  it('scopes keys per user and runs normally without a key', async () => {
    const a = await t.as('CLIENT');
    const b = await t.as('CLIENT');
    const before = calls;
    await post('/idem', { ...a.headers, 'idempotency-key': 'mesma-chave-1' });
    await post('/idem', { ...b.headers, 'idempotency-key': 'mesma-chave-1' });
    await post('/idem', a.headers);
    await post('/idem', a.headers);
    expect(calls - before).toBe(4);
  });

  it('refuses a reused key with a different body and malformed keys', async () => {
    const { headers } = await t.as('CLIENT');
    await post('/idem', { ...headers, 'idempotency-key': 'chave-unica-9' }, { a: 1 });
    const reused = await post('/idem', { ...headers, 'idempotency-key': 'chave-unica-9' }, { a: 2 });
    expect(reused.json()).toMatchObject({ status: 422, title: 'Chave de idempotência já usada' });
    const bad = await post('/idem', { ...headers, 'idempotency-key': 'curta' });
    expect(bad.json()).toMatchObject({ title: 'Chave de idempotência inválida' });
  });

  it('ignores the key for guests, server errors and non JSON bodies', async () => {
    const guest = await post('/idem', { 'idempotency-key': 'visitante-123' });
    expect(guest.headers['idempotent-replayed']).toBeUndefined();

    const { headers } = await t.as('CLIENT');
    const h = { ...headers, 'idempotency-key': 'falha-servidor-1' };
    expect((await post('/idem-fail', h)).statusCode).toBe(500);
    expect((await post('/idem-fail', h)).headers['idempotent-replayed']).toBeUndefined();

    const s = { ...headers, 'idempotency-key': 'stream-body-1' };
    await post('/idem-stream', s);
    expect((await post('/idem-stream', s)).headers['idempotent-replayed']).toBeUndefined();
  });
});
