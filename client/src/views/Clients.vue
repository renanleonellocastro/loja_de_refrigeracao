<template>
  <div>
    <div class="main-container">
      <h1>Gerenciar clientes</h1>
      <ClientsList/>
    </div>
  </div>
</template>

<script>
import ClientsList from '../components/ClientsList'

export default {
  name: 'Clients',
  components: {
    ClientsList
  }
}
</script>