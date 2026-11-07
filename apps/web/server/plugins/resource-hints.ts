import { deferPageScripts } from '../../app/utils/resource-hints';

/**
 * Scripts of server rendered pages start after the page has painted, see `deferPageScripts`. Runs before the
 * security headers plugin (plugins run in file name order), which gives the loader its nonce. The development
 * server keeps the Vite scripts as they are.
 */
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return;
  nitroApp.hooks.hook('render:html', (html) => {
    html.head = deferPageScripts(html);
  });
});
