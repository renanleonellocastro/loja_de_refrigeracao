<template>
  <div>
    <div class="main-container">
      <h1>Informações do Produto</h1>
      <ProductDetailsComponent :product_id_input_parameter="$route.params.id"/>
    </div>
  </div>
</template>

<script>
import ProductDetailsComponent from '../components/ProductDetailsComponent'

export default {
  name: 'ProductDetails',
  components: {
    ProductDetailsComponent
  }
}
</script>