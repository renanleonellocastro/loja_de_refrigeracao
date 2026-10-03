<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const online = useOnline();
const route = useRoute();

const kind = computed(() => errorKindFor(props.error.statusCode, online.value));

useHead({ title: computed(() => `Erro ${props.error.statusCode} | Refrigeração Castro`) });

function retry(): void {
  void clearError({ redirect: route.fullPath });
}
</script>

<template>
  <NuxtLayout>
    <ErrorState :kind="kind" :status-code="error.statusCode" @retry="retry" />
  </NuxtLayout>
</template>
