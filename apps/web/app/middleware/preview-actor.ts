import { isRole } from '@rc/contracts';

/**
 * Style guide only: lets /design/area?papel=CLIENT preview the signed in layout as any role.
 * Runs before rendering so the server and the browser draw the same menu.
 */
export default defineNuxtRouteMiddleware((to) => {
  const papel = to.query.papel;
  useActorPreview().value = isRole(papel) ? papel : 'MANAGER';
});
