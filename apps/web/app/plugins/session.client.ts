/**
 * Restores the session when the site opens in the browser, without holding the first paint of public pages.
 * On a server rendered page it waits for the hydration to finish: the server always renders the visitor view,
 * and swapping to the signed in header before hydrating would make Vue warn about mismatched markup.
 * Protected pages wait for the same restoration in the auth middleware.
 */
export default defineNuxtPlugin(() => {
  const nuxtApp = useNuxtApp();
  const restore = () => {
    void useAuthStore().restore({ onlyWithHint: true });
  };
  if (nuxtApp.isHydrating) nuxtApp.hooks.hookOnce('app:suspense:resolve', restore);
  else restore();
});
