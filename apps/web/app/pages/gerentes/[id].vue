<script setup lang="ts">
/** UC Consultar Gerentes (RF-08), com edição e exclusão para o super usuário. */
definePageMeta({ layout: 'area', permission: 'managers.manage', title: 'Gerentes' });
useHead({ title: 'Gerentes | Refrigeração Castro' });
</script>

<template>
  <UsersDetails kind="MANAGER" />
</template>
