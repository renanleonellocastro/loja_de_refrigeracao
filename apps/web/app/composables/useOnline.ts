import type { Ref } from 'vue';

/** Whether the browser has a network connection. Always true during server rendering. */
export function useOnline(): Ref<boolean> {
  const online = ref(true);
  const update = () => {
    online.value = navigator.onLine;
  };
  onMounted(() => {
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  });
  return online;
}
