import { describe, expect, it } from 'vitest';
import { InvalidConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies defaults for an empty environment', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      APP_ORIGIN: 'http://localhost:3000',
    });
  });

  it('coerces numeric values', () => {
    expect(loadConfig({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects invalid values listing every problem', () => {
    expect(() => loadConfig({ PORT: 'abc', APP_ORIGIN: 'not a url' })).toThrowError(InvalidConfigError);
    try {
      loadConfig({ PORT: 'abc', APP_ORIGIN: 'not a url' });
    } catch (error) {
      expect((error as InvalidConfigError).issues).toHaveLength(2);
    }
  });
});
