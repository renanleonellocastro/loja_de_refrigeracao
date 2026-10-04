import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const engines = (process.env.E2E_ENGINES ?? 'chromium').split(',');
// E2E_API=0 skips the API for runs that only need the site, like the visual baselines.
const withApi = process.env.E2E_API !== '0';

const viewports = [
  { name: 'celular', use: { ...devices['Pixel 7'] } },
  { name: 'tablet', use: { ...devices['iPad (gen 7)'] } },
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Visual baselines are per platform and device; a missing baseline is recorded instead of failing.
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  updateSnapshots: 'missing',
  use: { baseURL, trace: 'retain-on-failure', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' },
  projects: engines.flatMap((engine) =>
    viewports.map((viewport) => ({
      name: `${engine}-${viewport.name}`,
      use: { ...viewport.use, browserName: engine as 'chromium' | 'firefox' | 'webkit' },
    })),
  ),
  // The API runs on a dedicated database recreated with the development seed (apps/api/scripts/e2e-stack.ts).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        ...(withApi
          ? [
              {
                command: 'pnpm --filter @rc/api e2e:stack',
                url: 'http://localhost:3001/health',
                reuseExistingServer: !process.env.CI,
                timeout: 180_000,
              },
            ]
          : []),
        { command: 'pnpm --filter @rc/web dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
      ],
});
