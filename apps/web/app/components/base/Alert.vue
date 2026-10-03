<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-vue-next';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const props = withDefaults(defineProps<{ tone?: AlertTone; title?: string; dismissible?: boolean }>(), {
  tone: 'info',
  title: undefined,
});
const emit = defineEmits<{ dismiss: [] }>();

const TONES = {
  info: { classes: 'bg-info-soft text-on-info-soft border-on-info-soft/20', icon: Info },
  success: { classes: 'bg-success-soft text-on-success-soft border-on-success-soft/20', icon: CircleCheck },
  warning: { classes: 'bg-warning-soft text-on-warning-soft border-on-warning-soft/20', icon: TriangleAlert },
  danger: { classes: 'bg-danger-soft text-on-danger-soft border-on-danger-soft/20', icon: CircleAlert },
} as const;

const config = computed(() => TONES[props.tone]);
// Danger and warning interrupt screen readers; info and success wait their turn.
const role = computed(() => (props.tone === 'danger' || props.tone === 'warning' ? 'alert' : 'status'));
</script>

<template>
  <div class="flex items-start gap-3 rounded-lg border p-4" :class="config.classes" :role="role">
    <component :is="config.icon" class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div class="min-w-0 flex-1 text-sm leading-relaxed">
      <p v-if="title" class="font-semibold">{{ title }}</p>
      <div :class="title ? 'mt-0.5 opacity-90' : ''"><slot /></div>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
      aria-label="Fechar aviso"
      @click="emit('dismiss')"
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
