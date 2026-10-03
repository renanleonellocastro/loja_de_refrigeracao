import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  resolve: { conditions: ['@rc/source'] },
  test: {
    environment: 'nuxt',
    include: ['test/**/*.test.ts', 'app/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,vue}'],
      exclude: ['app/**/*.test.ts', 'app/app.vue'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
