import type { Ref } from 'vue';

export interface ResendOnReconnect {
  /** True while an action waits for the connection to come back. */
  pending: Ref<boolean>;
  /** Marks the action as waiting: the next `online` event of the browser runs it again. */
  wait: () => void;
  /** Forgets the waiting action (sent by hand, or no longer wanted). */
  cancel: () => void;
}

/**
 * Runs an action again by itself when the connection comes back (issue #81), so the technician in the field
 * does not need to remember to tap the button again. The action must be safe to repeat: send it with the
 * same Idempotency-Key, so a first attempt that did reach the store is answered again and never runs twice.
 */
export function useResendOnReconnect(resend: () => Promise<void>): ResendOnReconnect {
  const pending = ref(false);
  const onOnline = () => {
    if (!pending.value) return;
    pending.value = false;
    void resend();
  };
  onMounted(() => window.addEventListener('online', onOnline));
  onBeforeUnmount(() => window.removeEventListener('online', onOnline));
  return {
    pending,
    wait: () => {
      pending.value = true;
    },
    cancel: () => {
      pending.value = false;
    },
  };
}
