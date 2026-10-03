import { GUEST, type Actor } from '@rc/contracts';
import type { Ref } from 'vue';

/**
 * Who is using the app right now. Layouts and menus read the actor only through this composable.
 * Until sign in exists every visitor is a guest; milestone M2 replaces the state below with the auth store.
 */
export function useCurrentActor(): Ref<Actor> {
  return useState<Actor>('current-actor', () => GUEST);
}
