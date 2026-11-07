import { defineConfig, devices } from '@playwright/test';

// Retakes the screenshots of docs/MANUAL.md and the README from a running stack (docs/TESTES.md, "Imagens do
// manual"). Not part of the E2E suite: it writes images instead of asserting behavior.
export default defineConfig({
  testDir: './manual',
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'celular',
      use: { ...devices['Pixel 7'], viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 },
    },
  ],
});
