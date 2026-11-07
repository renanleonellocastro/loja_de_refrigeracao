import { dynamicStyleDirective } from '~/utils/dynamic-style';

/** Registers `v-dynamic-style` on the server and in the browser, see dynamicStyleDirective. */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('dynamic-style', dynamicStyleDirective);
});
