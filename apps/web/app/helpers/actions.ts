import type { Ref } from 'vue';
import { useToast } from '~/composables/useToast';
import { toApiError } from '~/utils/api-error';

/** Runs an action of the screen and shows its failure in a toast; answers whether it worked. */
export async function runOrToast(action: () => Promise<void>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    useToast().error({ title: toApiError(error).message });
    return false;
  }
}

/** Keeps `state` at `during` while the action runs and puts `idle` back afterwards, even when it fails. */
export async function holdWhile<State, Result>(
  state: Ref<State>,
  during: State,
  idle: State,
  action: () => Promise<Result>,
): Promise<Result> {
  state.value = during;
  try {
    return await action();
  } finally {
    state.value = idle;
  }
}
