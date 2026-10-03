<script setup lang="ts">
/** Status pill with the fixed color and icon of each order, service request and quote status. */
const props = withDefaults(defineProps<{ kind: StatusKind; status: string; size?: 'sm' | 'md' }>(), {
  size: 'md',
});

const TONES: Record<StatusTone, string> = {
  info: 'bg-info-soft text-on-info-soft ring-on-info-soft/15',
  progress: 'bg-accent-soft text-on-accent-soft ring-on-accent-soft/15',
  warning: 'bg-warning-soft text-on-warning-soft ring-on-warning-soft/15',
  success: 'bg-success-soft text-on-success-soft ring-on-success-soft/15',
  danger: 'bg-danger-soft text-on-danger-soft ring-on-danger-soft/15',
  neutral: 'bg-surface-sunken text-text-muted ring-border-strong/20',
};

const meta = computed(() => statusMeta(props.kind, props.status));
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset"
    :class="[TONES[meta.tone], size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm']"
    :data-status="status"
  >
    <component :is="meta.icon" :class="size === 'sm' ? 'size-3.5' : 'size-4'" aria-hidden="true" />
    {{ meta.label }}
  </span>
</template>
