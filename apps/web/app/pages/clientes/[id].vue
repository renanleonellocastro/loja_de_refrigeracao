<script setup lang="ts">
/** UC Consultar Clientes (RF-05), com edição e exclusão para o super usuário. */
definePageMeta({ layout: 'area', permission: 'customers.read', title: 'Clientes' });
useHead({ title: 'Clientes | Refrigeração Castro' });
</script>

<template>
  <UsersDetails kind="CLIENT" />
</template>
