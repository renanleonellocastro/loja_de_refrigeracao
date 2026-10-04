<script setup lang="ts">
import { Bell } from 'lucide-vue-next';

/** Bell of the top bar with the unread count, refreshed on navigation and every minute. */
const POLL_MS = 60_000;
const auth = useAuthStore();
const route = useRoute();
const { count, refresh } = useUnreadCount();

const label = computed(() => {
  if (count.value === 0) return 'Notificações';
  return `Notificações, ${count.value} ${count.value === 1 ? 'não lida' : 'não lidas'}`;
});

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void refresh();
  timer = setInterval(() => void refresh(), POLL_MS);
});
onBeforeUnmount(() => clearInterval(timer));
watch(() => [route.path, auth.signedIn], () => void refresh());
</script>

<template>
  <NuxtLink
    to="/notificacoes"
    :aria-label="label"
    :title="label"
    class="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-text"
  >
    <Bell class="size-5" aria-hidden="true" />
    <span
      v-if="count > 0"
      class="absolute top-1.5 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] font-bold text-on-danger tabular-nums ring-2 ring-surface"
      aria-hidden="true"
      data-testid="unread-badge"
    >
      {{ count > 99 ? '99+' : count }}
    </span>
  </NuxtLink>
</template>
