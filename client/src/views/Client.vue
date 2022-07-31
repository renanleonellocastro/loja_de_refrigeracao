<template>
  <div>
    <div class="main-container">
      <h1>Cadastrar Cliente</h1>
      <ClientForm/>
    </div>
  </div>
</template>

<script>
import ClientForm from '../components/ClientForm'

export default {
  name: 'Client',
  components: {
    ClientForm
  }
}
</script>