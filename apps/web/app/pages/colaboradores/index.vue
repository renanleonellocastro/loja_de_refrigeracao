<script setup lang="ts">
/** UCs Listar, Buscar e Cadastrar Colaboradores (RF-07). */
definePageMeta({ layout: 'area', permission: 'employees.read', title: 'Colaboradores' });
useHead({ title: 'Colaboradores | Refrigeração Castro' });
</script>

<template>
  <UsersDirectory kind="EMPLOYEE" />
</template>
