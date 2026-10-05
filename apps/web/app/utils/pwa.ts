/**
 * Registers the service worker (public/sw.js) that makes the site installable and keeps the offline page and
 * the technician's day. Development builds skip it: their unhashed modules must never come from a cache.
 */
export async function registerServiceWorker(
  navigator: Pick<Navigator, 'serviceWorker'> | Record<string, never>,
  dev: boolean,
): Promise<boolean> {
  if (dev || !('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return true;
  } catch {
    // Private windows and some embedded browsers refuse service workers; the site works without one.
    return false;
  }
}
