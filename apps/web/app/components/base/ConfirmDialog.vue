<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next';

/** Renders the question asked through useConfirm(). Mounted once in app.vue. */
const { current, settle } = useConfirm();

const open = computed({
  get: () => current.value !== null,
  // The dialog only ever asks to close (Escape or outside click), which counts as canceling.
  set: () => settle(false),
});
</script>

<template>
  <BaseDialog
    v-model:open="open"
    :title="current?.title ?? ''"
    :description="current?.description"
    size="sm"
    hide-close
  >
    <template v-if="current?.danger" #icon>
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-on-danger-soft"
      >
        <TriangleAlert class="size-5" aria-hidden="true" />
      </span>
    </template>
    <template #footer>
      <BaseButton variant="secondary" @click="settle(false)">{{ current?.cancelLabel }}</BaseButton>
      <BaseButton :variant="current?.danger ? 'danger' : 'primary'" @click="settle(true)">
        {{ current?.confirmLabel }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
