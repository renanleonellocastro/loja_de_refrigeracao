<template>
  <div id="product-image-viewer">
    <img class="product-image" :src="image_url">
    <button v-if="(($root.loginRole <= managerRole) && (is_editing_input_parameter.is_editing === true))"
     class="exclude-button" @click="deleteImage()">
      <img class="exclude-image" src="../../public/img/exclude_button.png"/>
    </button>
  </div>
  <confirm-dialogue ref="confirmDialogue"></confirm-dialogue>
</template>

<script>
import roles from '../utils/roles';
import ConfirmDialogue from '../components/ConfirmationDialogue.vue';

export default {
  name: "ProductImageViewer",
  props: {
    product_id_input_parameter: String,
    image_id_input_parameter: Number,
    image_url_input_parameter: String,
    is_editing_input_parameter: Object
  },
  emits: {
    updateProductDetails: null
  },
  data() {
    return {
      managerRole: roles.roles.MANAGER,
      product_id: '',
      image_id: '',
      image_url: '',
    }
  },
  methods: {
    getApiEndpointToDeleteImage()
    {
        return "http://localhost:3000/products/" + this.product_id + "/image/" + this.image_id;
    },
    async deleteImage()
    {
      const ok = await this.$refs.confirmDialogue.show({
        title: 'Remover imagem ' + this.image_id,
        message: 'Você tem certeza que deseja remover a imagem ' + this.image_url + '?',
        okButton: 'Sim',
        cancelButton: "Cancelar"
      })

      if (ok) {
        try {
          const req = await fetch(this.getApiEndpointToDeleteImage(), {
            method: "DELETE",
            headers: {"Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken}
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          this.$emit('updateProductDetails');
        } catch (error) {
          alert(`Error: ${error}`);
        }
      }
    }
  },
  mounted()
  {
    this.product_id = this.product_id_input_parameter;
    this.image_id = this.image_id_input_parameter;
    this.image_url = this.image_url_input_parameter;
  },
  components: {
    ConfirmDialogue
  }
}
</script>

<style>
#product-image-viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  place-self: center;
  min-width: 320px;
  max-width: 320px;
  min-height: 320px;
  max-height: 320px;
  padding: 10px 20px;
  border-radius: 15px;
  box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;
}
#product-image-viewer img {
  max-width: 300px;
  max-height: 300px;
}
#product-image-viewer button {
  padding: 10px 20px;
  border-radius: 30px;
  font-family: 'Noto Sans', sans-serif;
  border: solid 0px transparent;
}
#product-image-viewer button:hover {
  filter: brightness(1.1);
  cursor: pointer;
}
#product-image-viewer {
  width: 100%;
  position: relative;
}
#product-image-viewer .product-image {
  position: relative;
  top: 50%;
}
#product-image-viewer .exclude-button {
  position: absolute;
  top: -25px;
  right: -25px;
  padding: 0px 0px;
  border: transparent;
  border-radius: 20px;
}
#product-image-viewer .exclude-button .exclude-image {
  max-width: 50px;
  max-height: 50px;
}
#product-image-viewer .fade-in {
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
</style>