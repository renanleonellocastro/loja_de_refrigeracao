import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { AppContext } from '../context.js';
import { unprocessable } from '../shared/errors.js';
import {
  findStoredResponse,
  storeResponse,
  type KeyClaim,
  type StoredResponse,
} from './idempotency-store.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Accepts an Idempotency-Key header; repeating the key returns the first response. */
    idempotent?: boolean;
  }
  interface FastifyRequest {
    idempotency: { key: string; hash: string; userId: number } | null;
  }
}

type PendingResponse = NonNullable<FastifyRequest['idempotency']>;

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;
const SERVER_ERROR_STATUS = 500;
const REPLAY_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'idempotent-replayed': 'true' };

function routeOf(request: FastifyRequest): string {
  return `${request.method} ${request.routeOptions.url}`;
}

/** The key of an authenticated call to an idempotent route, or undefined when the call does not claim one. */
function claimedKey(request: FastifyRequest): KeyClaim | undefined {
  const key = request.headers['idempotency-key'];
  if (!request.routeOptions.config.idempotent || typeof key !== 'string' || !request.auth) return undefined;
  return { key, userId: request.auth.userId };
}

function assertValidKey(key: string): void {
  if (KEY_PATTERN.test(key)) return;
  throw unprocessable(
    'invalid-idempotency-key',
    'Chave de idempotência inválida',
    'Use de 8 a 200 letras, números, _ ou -.',
  );
}

function requestHash(request: FastifyRequest): string {
  return createHash('sha256')
    .update(`${routeOf(request)}\n${JSON.stringify(request.body ?? null)}`)
    .digest('hex');
}

function assertSameRequest(stored: StoredResponse, hash: string): void {
  if (stored.requestHash === hash) return;
  throw unprocessable(
    'idempotency-key-reused',
    'Chave de idempotência já usada',
    'Esta chave já foi usada com outros dados. Gere uma nova chave.',
  );
}

/** The stored body is already serialized JSON: write it as is, outside the schema serializer. */
function replayStoredResponse(reply: FastifyReply, stored: StoredResponse): FastifyReply {
  reply.hijack();
  reply.raw.writeHead(stored.responseStatus, REPLAY_HEADERS);
  reply.raw.end(JSON.stringify(stored.responseBody));
  return reply;
}

async function replayOrRemember(ctx: AppContext, request: FastifyRequest, reply: FastifyReply) {
  const claim = claimedKey(request);
  if (!claim) return;
  assertValidKey(claim.key);
  const hash = requestHash(request);
  const stored = await findStoredResponse(ctx.db, claim);
  if (stored) {
    assertSameRequest(stored, hash);
    return replayStoredResponse(reply, stored);
  }
  request.idempotency = { ...claim, hash };
}

function isStorable(reply: FastifyReply, payload: unknown): payload is string {
  return reply.statusCode < SERVER_ERROR_STATUS && typeof payload === 'string';
}

function responseRecord(
  request: FastifyRequest,
  reply: FastifyReply,
  pending: PendingResponse,
  payload: string,
) {
  return {
    userId: pending.userId,
    key: pending.key,
    route: routeOf(request),
    requestHash: pending.hash,
    responseStatus: reply.statusCode,
    responseBody: JSON.parse(payload) as unknown,
  };
}

async function storeFirstResponse(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
) {
  const pending = request.idempotency;
  if (pending && isStorable(reply, payload)) {
    await storeResponse(ctx.db, responseRecord(request, reply, pending, payload));
  }
  return payload;
}

/** docs/API.md: POST /orders, /counter-sales, /service-requests and /quotes are safe to retry. */
export const idempotencyPlugin = fp<{ ctx: AppContext }>(async (app, { ctx }) => {
  app.decorateRequest('idempotency', null);
  app.addHook('preHandler', async (request, reply) => replayOrRemember(ctx, request, reply));
  app.addHook('onSend', async (request, reply, payload) => storeFirstResponse(ctx, request, reply, payload));
});
