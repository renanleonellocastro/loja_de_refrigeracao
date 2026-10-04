<script setup lang="ts">
/** Invitation sent when the team registers someone (RF-04, RF-08, RF-09): the person creates the password. */
definePageMeta({ layout: 'auth' });
useSeoMeta({ title: 'Criar senha | Refrigeração Castro', robots: 'noindex' });
const route = useRoute();
</script>

<template>
  <AuthNewPasswordForm kind="invitation" :token="String(route.params.token)" />
</template>
