<template>
  <Message :msg="msg" v-show="msg" />
  <div>
    <form id="product-form" method="POST" @submit="createProduct">
      <div class="input-container">
        <label for="name">Nome do produto:</label>
        <input type="text" id="name" name="name" v-model="name" placeholder="Ex.: Geladeira Brastemp">
      </div>
      <div class="input-container">
        <label for="price">Preço do produto:</label>
        <input type="number" min="0.00" max="100000.00" step="0.01" id="price" name="price" v-model="price" placeholder="Ex.: 1999.99">
      </div>
      <div class="input-container">
        <label for="description">Descrição do produto:</label>
        <textarea id="description" name="description" v-model="description" placeholder="Ex.: Produto seminovo com acabamento cromado."></textarea>
      </div>
      <div class="input-container">
        <label for="state">Estado do produto:</label>
        <input type="radio" id="new" value="Novo" v-model="state"/>
        <label for="new">Novo</label>
        <input type="radio" id="old" value="Seminovo" v-model="state"/>
        <label for="old">Seminovo</label>
      </div>
      <div class="input-container">
        <label for="quantity">Quantidade em estoque:</label>
        <input type="number" id="quantity" name="quantity" v-model="quantity" placeholder="Ex.: 99">
      </div>
      <div class="input-container">
        <label for="category">Categoria do produto:</label>
        <select v-model="category">
        <option v-for="category in categories" :value="category.categoryid">
          {{ category.name }}
        </option>
        </select>
      </div>
      <div class="input-contianer">
        <label for="images">Imagens do produto:</label>
        <div class="product-input-images" v-for="imageindex in number_of_images">
          <input name="file" style="display:none" type="file" @change="onFile" accept="image/png, image/jpeg" ref="fileInput"/>
          <button @click.prevent="$refs.fileInput[imageindex-1].click()">Adicionar Imagem</button>
          <img :src="imagesource[imageindex-1].base64image" v-if="imagesource[imageindex-1].base64image"/>
        </div>
      </div>
      <div class="input-container">
        <input class="submit-btn" type="submit" value="Cadastrar Produto!">
      </div>
    </form>
  </div>
</template>

<script>
import axios from 'axios';
import Message from './Message'

export default {
  name: "ProductForm",
  data() {
    return {
      categories: null,
      name: null,
      price: null,
      description: null,
      state: null,
      quantity: null,
      category: null,
      msg: null,
      number_of_images: 1,
      imagesource: [{name:null, rawimage:null, base64image:null}]
    }
  },
  methods: {
    scrollToTop()
    {
      window.scrollTo(0,0);
    },
    async getCategories()
    {
      try {
        const req = await fetch("http://localhost:3000/categories", {
          method: "GET",
          headers: { "Content-Type" : "application/json" }
        });

        if (!req.ok) {
          throw new Error(`Error! status: ${req.status}`);
        }

        const res = await req.json();
        this.categories = res.categories;

      } catch (error) {
        console.log(`Error: ${error}`);
      }
    },
    async createProduct(e)
    {
      e.preventDefault();

      const data = { name: this.name, price: this.price, description: this.description, state: this.state, quantity: this.quantity,
        categoryid: this.category };
      const dataJson = JSON.stringify(data);

        try {
          const req = await fetch("http://localhost:3000/products", {
            method: "POST",
            headers: {"Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken},
            body: dataJson
          });

          if (!req.ok) {
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          await this.uploadProductImages(res.productid);
          this.msg = "Produto " + this.name + " cadastrado com sucesso!";
          this.clearData();
          this.scrollToTop();
        } catch (error) {
          this.msg = `Error: ${error}`;
          this.scrollToTop();
        }

        setTimeout(() => this.msg = "", 3000);
    },
    async uploadProductImages(id)
    {
      for (var i = 0; i < (this.imagesource.length - 1); i++) {
        let formData = new FormData();
        formData.append('filename', this.imagesource[i].name);
        formData.append('image', this.imagesource[i].rawimage);
        await axios.post(`http://localhost:3000/products/${id}/image`, formData, {
          headers: {
            'Authorization': 'Bearer ' + this.$root.loginToken,
            'Content-Type': `multipart/form-data; boundary=${formData._boundary}` 
          },
        });
      }
    },
    async onFile(e) {
      const files = e.target.files;

      if (!files.length) {
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(files[0]);
      this.imagesource[this.imagesource.length - 1].name = files[0].name;
      this.imagesource[this.imagesource.length - 1].rawimage = files[0];
      reader.onload = () => {
        this.imagesource[this.imagesource.length - 1].base64image = reader.result;
        this.imagesource.push({name: null, rawimage:null, base64image:null});
        this.number_of_images++;
      };
    },
    clearData()
    {
      this.name = "";
      this.price = "";
      this.description = "";
      this.state = "";
      this.quantity = "";
      this.category = "";
    }
  },
  async mounted()
  {
    await this.getCategories();
  },
  components: {
    Message
  }
}
</script>

<style scoped>
  #product-form {
    max-width: 400px;
    margin: 0 auto;
  }

  #product-form img {
  max-width: 100px;
  max-height: 100px;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
  }

  label {
    font-weight: bold;
    margin-bottom: 15px;
    color: #222;;
    padding: 5px 10px;
    border-left: 4px solid #fcba03;
  }

  input, select {
    padding: 5px 10px;
    width: 300px;
  }

  #opcionais-container {
    flex-direction: row;
    flex-wrap: wrap;
  }

  #opcionais-title {
    width: 100%;
  }

  .checkbox-container {
    display: flex;
    align-items: flex-start;
    width: 50%;
    margin-bottom: 20px;
  }

  .checkbox-container span,
  .checkbox-container input {
    width: auto;
  }

  .checkbox-container span {
    margin-left: 6px;
    font-weight: bold;
  }

  .submit-btn {
    background-color: #222;
    color:#fcba03;
    font-weight: bold;
    border: 2px solid #222;
    padding: 10px;
    font-size: 16px;
    margin: 0 auto;
    cursor: pointer;
    transition: .5s;
  }

  .submit-btn:hover {
    background-color: transparent;
    color: #222;
  }
</style>
