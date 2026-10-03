import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = await buildApp({ config });

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ host: config.HOST, port: config.PORT });
