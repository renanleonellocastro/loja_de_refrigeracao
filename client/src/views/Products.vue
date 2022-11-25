<template>
  <div>
    <div class="main-container">
      <h1>Gerenciar produtos</h1>
      <ProductsList/>
    </div>
  </div>
</template>

<script>
import ProductsList from '../components/ProductsList'

export default {
  name: 'Products',
  components: {
    ProductsList
  }
}
</script>