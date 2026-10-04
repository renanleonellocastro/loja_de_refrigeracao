import tailwindcss from '@tailwindcss/vite';
import { THEME_BOOT_SCRIPT } from './app/utils/theme';
import { PRIVATE_ROUTES } from './app/utils/routes';

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@nuxt/fonts', '@nuxt/image', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    resolve: { conditions: ['@rc/source'] },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      title: 'Refrigeração Castro',
      meta: [
        {
          name: 'description',
          content:
            'Refrigeração Castro, Mogi Mirim/SP: conserto de geladeiras, ar condicionado e lavadoras há mais de 40 anos.',
        },
        { name: 'theme-color', content: '#184E86' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      // Applies the saved theme before the first paint, so there is no flash of the other theme.
      script: [{ innerHTML: THEME_BOOT_SCRIPT, tagPosition: 'head' }],
    },
  },
  fonts: {
    families: [
      { name: 'Archivo', weights: [700, 800], subsets: ['latin'] },
      { name: 'Inter', weights: [400, 500, 600, 700], subsets: ['latin'] },
    ],
  },
  runtimeConfig: {
    // Origin of the API; the typed client paths already start with /api/v1. Set NUXT_PUBLIC_API_BASE in production.
    public: { apiBase: 'http://localhost:3001' },
  },
  // Public pages render on the server for speed and search engines; signed in areas render in the browser,
  // where the session lives (the access token is kept in memory only).
  routeRules: Object.fromEntries(
    PRIVATE_ROUTES.flatMap((path) => [
      [path, { ssr: false }],
      [`${path}/**`, { ssr: false }],
    ]),
  ),
  typescript: { strict: true },
});
