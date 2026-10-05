/**
 * Server rendered pages are readable before any script runs: the scripts only hydrate them. Their preload
 * hints therefore go out with low fetch priority, so on a slow phone the hero image and the HTML come first
 * (RNF-07). The scripts still start downloading right away.
 */
export function lowerScriptPreloadPriority(headTags: string): string {
  return headTags.replace(
    /<link rel="modulepreload"(?![^>]*fetchpriority)/g,
    '<link rel="modulepreload" fetchpriority="low"',
  );
}
