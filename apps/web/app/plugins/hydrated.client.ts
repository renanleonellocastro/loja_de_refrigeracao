/** Marks <html data-hydrated="true"> once the app is interactive, for E2E tests and CSS that waits on it. */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:suspense:resolve', () => {
    document.documentElement.dataset.hydrated = 'true';
  });
});
