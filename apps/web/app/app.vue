<script setup lang="ts">
// The confirmation dialog (and the dialog library behind it) downloads the first time a page asks a
// question, so public pages do not carry it on the first load.
const { current } = useConfirm();
const confirmUsed = ref(false);
watch(current, (request) => {
  if (request) confirmUsed.value = true;
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <BaseToastRegion />
  <LazyBaseConfirmDialog v-if="confirmUsed" />
</template>
