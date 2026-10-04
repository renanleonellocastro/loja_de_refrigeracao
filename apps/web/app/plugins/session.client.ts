/**
 * Restores the session when the site opens in the browser, without holding the first paint of public pages.
 * Protected pages wait for the same restoration in the auth middleware.
 */
export default defineNuxtPlugin(() => {
  void useAuthStore().restore({ onlyWithHint: true });
});
