import { describe, expect, it } from 'vitest';
import { InvalidConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies development defaults for an empty environment', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      APP_ORIGIN: 'http://localhost:3000',
      COOKIE_SECURE: false,
      TRUST_PROXY: false,
    });
  });

  it('coerces numbers and booleans', () => {
    const config = loadConfig({ PORT: '8080', COOKIE_SECURE: 'true', TRUST_PROXY: 'false' });
    expect(config).toMatchObject({ PORT: 8080, COOKIE_SECURE: true, TRUST_PROXY: false });
  });

  it('turns secure defaults on in production', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@db/castro',
      JWT_SECRET: 'x'.repeat(40),
    });
    expect(config).toMatchObject({ COOKIE_SECURE: true, TRUST_PROXY: true });
  });

  it('requires real secrets in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrowError(
      /JWT_SECRET: must be set in production/,
    );
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrowError(
      /DATABASE_URL: must be set in production/,
    );
  });

  it('lists every invalid value', () => {
    try {
      loadConfig({ PORT: 'abc', APP_ORIGIN: 'not a url', JWT_SECRET: 'short' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigError);
      expect((error as InvalidConfigError).issues).toHaveLength(3);
    }
  });
});
