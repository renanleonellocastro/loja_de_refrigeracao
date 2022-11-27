<template>
  <div id="product-item" v-bind:style="{opacity: opacity}">
    <div id="product-item-exclude">
      <img class="product-image" :src="image_url">
      <button v-if="$root.loginRole <= managerRole" class="exclude-button" @click="deleteProduct()">
        <img class="exclude-image" src="../../public/img/exclude_button.png"/>
      </button>
    </div>
    <h2>{{ name }}</h2>
    <h3>{{ price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) }}</h3>
    <button v-if="quantity != 0" @click="addToOrder()">Adicionar ao pedido</button>
    <p v-if="quantity === 0">Não disponível</p>
    <confirm-dialogue ref="confirmDialogue"></confirm-dialogue>
  </div>

</template>

<script>
import roles from '../utils/roles'
import * as common from '../utils/common';
import ConfirmDialogue from '../components/ConfirmationDialogue.vue'

export default {
  name: "ProductItem",
  props: {
      id: Number,
      name: String,
      price: Number,
      quantity: Number
  },
  data() {
      return {
        managerRole: roles.roles.MANAGER,
        image_url: '',
        opacity: 1
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
          common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
          throw new Error(`Error! status: ${req.status}`);
        }

        const res = await req.json();
        this.image_url = res.images[0].url;

      } catch (error) {
        console.log(`Error: ${error}`);
      }
    },
    async deleteProduct()
    {
      const ok = await this.$refs.confirmDialogue.show({
        title: 'Remover produto ' + this.id,
        message: 'Você tem certeza que deseja remover o produto ' + this.name + '?',
        okButton: 'Sim',
        cancelButton: "Cancelar"
      })

      if (ok) {
        try {
          const req = await fetch("http://localhost:3000/products/" + this.id, {
            method: "DELETE",
            headers: {"Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken}
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          this.$emit('updateProducts');
        } catch (error) {
          alert(`Error: ${error}`);
        }
      }
    },
    checkIfItemIsAvailableAndSetOpacity() {
      if (this.quantity === 0) {
        this.opacity = 0.5;
      }
    }
  },
  async mounted()
  {
    this.checkIfItemIsAvailableAndSetOpacity();
    await this.getImageUrl();
  },
  components: {
    ConfirmDialogue
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
  max-height: 200px;
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
#product-item #product-item-exclude {
  width: 100%;
  position: relative;
}
#product-item #product-item-exclude .product-image {
  position: relative;
  left: 50%;
  transform: translateX(-50%);
}
#product-item #product-item-exclude .exclude-button {
  position: absolute;
  top: -30px;
  right: -40px;
  padding: 0px 0px;
  border: transparent;
  border-radius: 20px;
}
#product-item #product-item-exclude .exclude-button .exclude-image {
  max-width: 50px;
  max-height: 50px;
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