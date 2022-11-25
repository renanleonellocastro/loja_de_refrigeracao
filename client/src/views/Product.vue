<template>
  <div>
    <div class="main-container">
      <h1>Cadastrar Produto</h1>
      <ProductForm/>
    </div>
  </div>
</template>

<script>
import ProductForm from '../components/ProductForm'

export default {
  name: 'Product',
  components: {
    ProductForm
  }
}
</script>