import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';

export interface AppDependencies {
  config: Config;
}

export async function buildApp({ config }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.LOG_LEVEL === 'silent' ? false : { level: config.LOG_LEVEL },
    genReqId: () => crypto.randomUUID(),
  });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
