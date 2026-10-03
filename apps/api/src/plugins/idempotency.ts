import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import fp from 'fastify-plugin';
import type { AppContext } from '../context.js';
import { idempotencyKeys } from '../infra/db/schema.js';
import { unprocessable } from '../shared/errors.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Accepts an Idempotency-Key header; repeating the key returns the first response. */
    idempotent?: boolean;
  }
  interface FastifyRequest {
    idempotency: { key: string; hash: string; userId: number } | null;
  }
}

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

/** docs/API.md: POST /orders, /counter-sales, /service-requests and /quotes are safe to retry. */
export const idempotencyPlugin = fp<{ ctx: AppContext }>(async (app, { ctx }) => {
  app.decorateRequest('idempotency', null);

  app.addHook('preHandler', async (request, reply) => {
    const key = request.headers['idempotency-key'];
    if (!request.routeOptions.config.idempotent || typeof key !== 'string' || !request.auth) return;
    if (!KEY_PATTERN.test(key)) {
      throw unprocessable(
        'invalid-idempotency-key',
        'Chave de idempotência inválida',
        'Use de 8 a 200 letras, números, _ ou -.',
      );
    }
    const route = `${request.method} ${request.routeOptions.url}`;
    const hash = createHash('sha256')
      .update(`${route}\n${JSON.stringify(request.body ?? null)}`)
      .digest('hex');
    const [stored] = await ctx.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, request.auth.userId), eq(idempotencyKeys.key, key)))
      .limit(1);
    if (stored) {
      if (stored.requestHash !== hash) {
        throw unprocessable(
          'idempotency-key-reused',
          'Chave de idempotência já usada',
          'Esta chave já foi usada com outros dados. Gere uma nova chave.',
        );
      }
      return reply
        .code(stored.responseStatus)
        .header('idempotent-replayed', 'true')
        .send(stored.responseBody);
    }
    request.idempotency = { key, hash, userId: request.auth.userId };
  });

  app.addHook('onSend', async (request, reply, payload) => {
    const pending = request.idempotency;
    if (!pending || reply.statusCode >= 500 || typeof payload !== 'string') return payload;
    await ctx.db
      .insert(idempotencyKeys)
      .values({
        userId: pending.userId,
        key: pending.key,
        route: `${request.method} ${request.routeOptions.url}`,
        requestHash: pending.hash,
        responseStatus: reply.statusCode,
        responseBody: JSON.parse(payload),
      })
      .onConflictDoNothing();
    return payload;
  });
});
