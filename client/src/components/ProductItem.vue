<template>
  <div id="product-item">
    <img :src="image_url" alt="/img/loading.jpg">
    <h2>{{ name }}</h2>
    <h3>{{ price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) }}</h3>
    <button @click="addToOrder()">Adicionar ao pedido</button>
  </div>

</template>

<script>
export default {
  name: "ProductItem",
  props: {
      id: Number,
      name: String,
      price: Number
  },
  data() {
      return {
        image_url: ''
      }
  },
  methods: {
    async addToOrder()
    {
      const data = { name: this.name, price: this.price};
      const dataJson = JSON.stringify(data);
      console.log(this.images[0].url);
    },
    getApiEndpoint()
    {
        return "http://localhost:3000/products/" + this.id + "/image";
    },
    async getImageUrl() {
      try {
        const req = await fetch(this.getApiEndpoint(), {
          method: "GET",
          headers: { "Content-Type" : "application/json" }
        });

        if (!req.ok) {
          throw new Error(`Error! status: ${req.status}`);
        }

        const res = await req.json();
        this.image_url = res.images[0].url;

      } catch (error) {
        console.log(`Error: ${error}`);
      }
    }
  },
  async mounted()
  {
    await this.getImageUrl();
  }
}
</script>

<style>
#product-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  place-self: center;
  min-width: 240px;
  max-width: 360px;
  padding: 10px 20px;
  background-color: #f1f1f1;
  border-radius: 15px;
  box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;
}
#product-item h2,h3 {
  font-family: 'Noto Sans', sans-serif;
  margin: 0 0 10px 0;
}
#product-item img {
  max-width: 100px;
  max-height: 100px;
}
#product-item h1 {
  font-family: 'Patrick Hand', cursive;
}
#product-item p {
  font-family: 'Noto Sans', sans-serif;
}
#product-item button {
  padding: 10px 20px;
  border-radius: 30px;
  font-family: 'Noto Sans', sans-serif;
  border: solid 1px #999999;
}
#product-item button:hover {
  filter: brightness(1.1);
  cursor: pointer;
}
#product-item .fade-in {
  animation: fadeIn ease 500ms;
  -webkit-animation: fadeIn ease 500ms;
  -moz-animation: fadeIn ease 500ms;
  -o-animation: fadeIn ease 500ms;
  -ms-animation: fadeIn ease 500ms;
}

@keyframes fadeIn {
  0% {
    opacity:0;
  }
  100% {
    opacity:1;
  }
}

@-moz-keyframes fadeIn {
  0% {
    opacity:0;
  }
  100% {
    opacity:1;
  }
}

@-webkit-keyframes fadeIn {
  0% {
    opacity:0;
  }
  100% {
    opacity:1;
  }
}

@-o-keyframes fadeIn {
  0% {
    opacity:0;
  }
  100% {
    opacity:1;
  }
}

@-ms-keyframes fadeIn {
  0% {
    opacity:0;
  }
  100% {
    opacity:1;
}
}

@media only screen and (max-width: 800px) {
  #product-item {
    min-width: auto;
    max-width: 160px;
    padding: 15px 5px;
  }
  #product-item img {
    max-width: 75px;
    max-height: 75px;
  }
  #product-item h2 {
    font-size: 1.2rem;
  }
  #product-item h3 {
    font-size: 1rem;
  }
  #product-item button {
    padding: 5px 10px;
  }
}
</style>