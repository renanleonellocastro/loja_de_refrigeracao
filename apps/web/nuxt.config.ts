import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@nuxt/fonts', '@nuxt/image'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    resolve: { conditions: ['@rc/source'] },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
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
    },
  },
  fonts: {
    families: [
      { name: 'Archivo', weights: [700, 800], subsets: ['latin'] },
      { name: 'Inter', weights: [400, 500, 600, 700], subsets: ['latin'] },
    ],
  },
  runtimeConfig: {
    public: { apiBase: 'http://localhost:3001/api/v1' },
  },
  typescript: { strict: true },
});
