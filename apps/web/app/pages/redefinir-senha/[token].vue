<script setup lang="ts">
/** UC Recuperar Senha (RF-02), step 5: the link from the email opens this page. */
definePageMeta({ layout: 'auth' });
useSeoMeta({ title: 'Nova senha | Refrigeração Castro', robots: 'noindex' });
const route = useRoute();
</script>

<template>
  <AuthNewPasswordForm kind="reset" :token="String(route.params.token)" />
</template>
