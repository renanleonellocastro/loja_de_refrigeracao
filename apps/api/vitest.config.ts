import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@rc/source'] },
  ssr: { resolve: { conditions: ['@rc/source'], externalConditions: ['@rc/source'] } },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts', 'src/worker.ts', 'src/seed.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
