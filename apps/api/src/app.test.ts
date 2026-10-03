import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

describe('buildApp', () => {
  it('answers the health check', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }) });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('enables the logger when a level is configured', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'fatal' }) });
    expect(app.log.level).toBe('fatal');
    await app.close();
  });
});
