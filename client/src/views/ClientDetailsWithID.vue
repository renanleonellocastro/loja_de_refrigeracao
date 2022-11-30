<template>
  <div>
    <div class="main-container">
      <h1>Informações do Usuário</h1>
      <ClientDetailsComponent :user_id_input_parameter="$route.params.id"/>
    </div>
  </div>
</template>

<script>
import ClientDetailsComponent from '../components/ClientDetailsComponent'

export default {
  name: 'ClientDetailsWithID',
  components: {
    ClientDetailsComponent
  }
}
</script>