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
      SIGN_UP_LIMIT_PER_HOUR: 10,
    });
  });

  it('coerces numbers and booleans', () => {
    const config = loadConfig({
      PORT: '8080',
      COOKIE_SECURE: 'true',
      TRUST_PROXY: 'false',
      SIGN_UP_LIMIT_PER_HOUR: '1000',
    });
    expect(config).toMatchObject({
      PORT: 8080,
      COOKIE_SECURE: true,
      TRUST_PROXY: false,
      SIGN_UP_LIMIT_PER_HOUR: 1000,
    });
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

  it('reads the S3 storage settings, empty values meaning not set', () => {
    expect(loadConfig({ STORAGE_DRIVER: 's3', S3_BUCKET: 'fotos', S3_ENDPOINT: '' })).toMatchObject({
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'fotos',
      S3_REGION: 'us-east-1',
      S3_ENDPOINT: undefined,
      S3_FORCE_PATH_STYLE: false,
    });
    expect(loadConfig({ S3_ENDPOINT: 'http://localhost:9000' }).S3_FORCE_PATH_STYLE).toBe(true);
    expect(
      loadConfig({ S3_ENDPOINT: 'https://r2.example', S3_FORCE_PATH_STYLE: 'false' }).S3_FORCE_PATH_STYLE,
    ).toBe(false);
  });

  it('requires a bucket for S3 and both keys or none', () => {
    expect(() => loadConfig({ STORAGE_DRIVER: 's3' })).toThrowError(/S3_BUCKET: required/);
    expect(() => loadConfig({ S3_ACCESS_KEY_ID: 'id' })).toThrowError(
      /S3_SECRET_ACCESS_KEY: S3_ACCESS_KEY_ID and/,
    );
    expect(loadConfig({ S3_ACCESS_KEY_ID: 'id', S3_SECRET_ACCESS_KEY: 'secret' }).S3_ACCESS_KEY_ID).toBe(
      'id',
    );
  });
});
