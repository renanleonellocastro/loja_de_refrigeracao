<script setup lang="ts">
/** UC Consultar Colaboradores (RF-07), com edição e exclusão para o super usuário. */
definePageMeta({ layout: 'area', permission: 'employees.read', title: 'Colaboradores' });
useHead({ title: 'Colaboradores | Refrigeração Castro' });
</script>

<template>
  <UsersDetails kind="EMPLOYEE" />
</template>
