<script setup lang="ts">
/** UCs Listar, Buscar e Cadastrar Gerentes (RF-08). */
definePageMeta({ layout: 'area', permission: 'managers.manage', title: 'Gerentes' });
useHead({ title: 'Gerentes | Refrigeração Castro' });
</script>

<template>
  <UsersDirectory kind="MANAGER" />
</template>
