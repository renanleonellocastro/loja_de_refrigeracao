import type { FastifyInstance, FastifyReply } from 'fastify';
import { sql } from 'drizzle-orm';
import type { AppContext } from '../context.js';

const UNAVAILABLE_STATUS = 503;
const hidden = { schema: { hide: true } };

async function readiness(ctx: AppContext, reply: FastifyReply) {
  try {
    await ctx.db.execute(sql`select 1`);
    return { status: 'ready' };
  } catch {
    return reply.code(UNAVAILABLE_STATUS).send({ status: 'unavailable' });
  }
}

/** Liveness and readiness for the load balancer, kept out of the OpenAPI document. */
export function registerProbes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/health', hidden, async () => ({ status: 'ok' }));
  app.get('/ready', hidden, async (_request, reply) => readiness(ctx, reply));
}
