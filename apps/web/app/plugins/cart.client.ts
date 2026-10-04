/**
 * Keeps the cart in step with the session: the visitor cart once the page is interactive (so the badge
 * does not break hydration), the account cart after signing in (merging the visitor cart) and back again
 * after signing out.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const cart = useCartStore();
    const auth = useAuthStore();
    watch(
      () => auth.signedIn,
      (signedIn) => {
        if (signedIn) void cart.syncAfterSignIn();
        else cart.switchToGuest();
      },
      { immediate: true },
    );
  });
});
