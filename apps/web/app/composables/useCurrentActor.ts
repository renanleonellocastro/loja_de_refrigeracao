import type { Actor } from '@rc/contracts';
import type { ComputedRef, Ref } from 'vue';

/** Role forced by the style guide preview (/design/area?papel=), or null to follow the signed in person. */
export function useActorPreview(): Ref<Actor | null> {
  return useState<Actor | null>('actor-preview', () => null);
}

/** Who is using the app right now. Layouts and menus read the actor only through this composable. */
export function useCurrentActor(): ComputedRef<Actor> {
  const preview = useActorPreview();
  const auth = useAuthStore();
  return computed(() => preview.value ?? auth.actor);
}
