<script setup lang="ts">
/** UCs Listar, Buscar e Cadastrar Clientes (RF-05). */
definePageMeta({ layout: 'area', permission: 'customers.read', title: 'Clientes' });
useHead({ title: 'Clientes | Refrigeração Castro' });
</script>

<template>
  <UsersDirectory kind="CLIENT" />
</template>
