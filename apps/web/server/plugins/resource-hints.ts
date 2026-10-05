import { lowerScriptPreloadPriority } from '../../app/utils/resource-hints';

/** Script preloads of server rendered pages go out with low priority, see `lowerScriptPreloadPriority`. */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head = html.head.map(lowerScriptPreloadPriority);
  });
});
