import tailwindcss from '@tailwindcss/vite';
import { THEME_BOOT_SCRIPT } from './app/utils/theme';
import { PRIVATE_ROUTES } from './app/utils/routes';

/** Modules shared by the public pages (home, catalog, product, services), bundled together. */
const PUBLIC_SHARED_MODULES = new RegExp(
  [
    String.raw`[\\/]app[\\/]utils[\\/](text|session|masks|status|catalog|store|service-requests|seo|ui|image|errors|products)\.ts$`,
    String.raw`[\\/]app[\\/]composables[\\/](useStoreInfo|usePageSeo|useToast|useApi|useOnline)\.ts$`,
    String.raw`[\\/]app[\\/]components[\\/](AppLogo|FrostLines|WhatsAppButton)\.vue`,
    String.raw`[\\/]app[\\/]components[\\/]base[\\/](Skeleton|Avatar|Breadcrumbs|IconButton|Spinner|Button|Card|Alert|EmptyState|DescriptionList)\.vue`,
    String.raw`[\\/]app[\\/]components[\\/](catalog[\\/](ProductImage|ProductCard)|illustration[\\/]EmptyBox|layout[\\/](SkipLink|SiteHeader))\.vue`,
    String.raw`[\\/]packages[\\/]contracts[\\/]src[\\/](permissions|roles)\.ts$`,
  ].join('|'),
);

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  features: { inlineStyles: true },
  modules: ['@nuxt/fonts', '@nuxt/image', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    resolve: { conditions: ['@rc/source'] },
    // Code shared by the public pages is grouped into a few larger chunks instead of dozens of tiny ones:
    // fewer requests before the first paint on mobile connections (RNF-07, RNF-09). Only modules of the
    // public site are listed, so signed in area code never rides along.
    $client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                { name: 'icons', test: /lucide-vue-next/ },
                { name: 'public', test: PUBLIC_SHARED_MODULES, minShareCount: 2 },
              ],
            },
          },
        },
      },
    },
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
        { property: 'og:site_name', content: 'Refrigeração Castro' },
        { property: 'og:locale', content: 'pt_BR' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
      // Applies the saved theme before the first paint, so there is no flash of the other theme.
      script: [{ innerHTML: THEME_BOOT_SCRIPT, tagPosition: 'head' }],
    },
  },
  // The hero image is the largest paint, so no font is preloaded: text shows in the fallback face (with
  // metrics matched by @nuxt/fonts) and swaps without competing with the image and the CSS for bandwidth.
  fonts: {
    defaults: { preload: false },
    families: [
      { name: 'Archivo', weights: [700, 800], styles: ['normal'], subsets: ['latin'] },
      { name: 'Inter', weights: [400, 500, 600, 700], styles: ['normal'], subsets: ['latin'] },
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
  // Built CSS, JS and SVG ship with gzip and brotli copies, served without compressing on each request.
  nitro: { compressPublicAssets: { gzip: true, brotli: true } },
  typescript: { strict: true },
  hooks: {
    // No prefetch hints for lazy components and other pages: on a slow phone they compete with the hero
    // image and the page scripts for the first seconds. They still load on demand.
    'build:manifest'(manifest) {
      for (const chunk of Object.values(manifest)) chunk.prefetch = false;
    },
  },
});
