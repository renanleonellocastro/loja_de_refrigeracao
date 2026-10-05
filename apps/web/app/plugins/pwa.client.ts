import { registerServiceWorker } from '~/utils/pwa';

/** Installs the PWA service worker once the page is interactive, never blocking the first paint. */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:suspense:resolve', () => {
    void registerServiceWorker(window.navigator, import.meta.dev);
  });
});
