<template>
  <div>
    <div class="main-container">
      <h1>Informações do Usuário</h1>
      <ClientDetailsComponent/>
    </div>
  </div>
</template>

<script>
import ClientDetailsComponent from '../components/ClientDetailsComponent'

export default {
  name: 'ClientDetails',
  components: {
    ClientDetailsComponent
  }
}
</script>