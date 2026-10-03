import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const engines = (process.env.E2E_ENGINES ?? 'chromium').split(',');

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
  use: { baseURL, trace: 'retain-on-failure', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' },
  projects: engines.flatMap((engine) =>
    viewports.map((viewport) => ({
      name: `${engine}-${viewport.name}`,
      use: { ...viewport.use, browserName: engine as 'chromium' | 'firefox' | 'webkit' },
    })),
  ),
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'pnpm --filter @rc/web dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
