import { can } from '@rc/contracts';
import { readOfflineDay } from '~/utils/offline-day';

/**
 * Route guard from the same permission matrix as the API (docs/REQUISITOS.md section 5). Pages declare
 * `definePageMeta({ permission: 'customers.read' })`; guests go to sign in and come back afterwards,
 * signed in people without the permission see the 403 page. Protected pages render only in the browser.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const permission = to.meta.permission;
  if (!permission || import.meta.server) return;
  const auth = useAuthStore();
  await auth.restore();
  // Without signal the session cannot be checked: a page with a saved copy opens read only from it.
  if (!auth.signedIn && auth.unreachable && to.meta.offlineCopy && readOfflineDay()) return;
  if (!auth.signedIn) return navigateTo({ path: '/entrar', query: { redirect: to.fullPath } });
  if (!can(auth.actor, permission)) {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Sem permissão', fatal: true }));
  }
});
