import type { Ref } from 'vue';

const CONNECTION_EVENTS = ['online', 'offline'] as const;

function listenToConnection(listener: () => void): void {
  for (const name of CONNECTION_EVENTS) window.addEventListener(name, listener);
}

function stopListeningToConnection(listener: () => void): void {
  for (const name of CONNECTION_EVENTS) window.removeEventListener(name, listener);
}

/** Whether the browser has a network connection. Always true during server rendering. */
export function useOnline(): Ref<boolean> {
  const online = ref(true);
  const update = () => {
    online.value = navigator.onLine;
  };
  onMounted(() => {
    update();
    listenToConnection(update);
  });
  onBeforeUnmount(() => stopListeningToConnection(update));
  return online;
}
