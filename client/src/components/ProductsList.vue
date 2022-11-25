<template>
  <div id="product-list" v-if="products !== null">
    <ProductItem v-for="product in products" :id="product.productid" :name="product.name" :price="product.price"/>
  </div>
  <div v-else>
    <h2>Não há produtos no momento!</h2>
  </div>
</template>
<script>
import ProductItem from './ProductItem'

export default {
  name: "ProductsList",
  data() {
    return {
      products: null
    }
  },
  methods: {
    async getProducts()
    {
      try {
        const req = await fetch("http://localhost:3000/products", {
          method: "GET",
          headers: { "Content-Type" : "application/json" }
        });

        if (!req.ok) {
          throw new Error(`Error! status: ${req.status}`);
        }

        const res = await req.json();
        this.products = res.products;

      } catch (error) {
        console.log(`Error: ${error}`);
      }
    }
  },
  components: {
    ProductItem
  },
  async mounted()
  {
    await this.getProducts();
  }
}
</script>

<style>
#product-list
{
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 1em;
  padding: 10px 20px;
}

@media only screen and (max-width: 800px) {
  #product-list
  {
    grid-template-columns: auto auto;
    gap: 0.5em;
    padding: 5px;
    margin-bottom: 20px;
  }
}

</style>