<template>
  <Message :msg="msg" v-show="msg" />
  <div>
    <div id="product-details">
      <div id=product-id>
        <label>ID:</label>
        <a> {{current_id}} </a>
        <br/><br/>
      </div>
      <div id=product-name>
        <label>Nome:</label>
        <a v-if="is_editing === false"> {{current_name}} </a>
        <input v-if="is_editing === true" type="text" v-model="new_name">
        <br/><br/>
      </div>
      <div id=product-state>
        <label>Estado:</label>
        <a v-if="is_editing === false"> {{current_state}} </a>
        <label class=radio-button-label v-if="is_editing === true" for="new">Novo</label>
        <input v-if="is_editing === true" type="radio" id="new" value="Novo" v-model="new_state"/>
        <label class=radio-button-label v-if="is_editing === true" for="old">Seminovo</label>
        <input v-if="is_editing === true" type="radio" id="old" value="Seminovo" v-model="new_state"/>
        <br/><br/>
      </div>
      <div id=product-price>
        <label>Preço:</label>
        <a v-if="is_editing === false"> {{ current_price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) }} </a>
        <input v-if="is_editing === true" type="number" min="0.00" max="100000.00" step="0.01" v-model="new_price">
        <br/><br/>
      </div>
      <div id=product-quantity>
        <label>Quantidade Disponível:</label>
        <a v-if="is_editing === false"> {{current_quantity}} </a>
        <input v-if="is_editing === true" type="number" min="0" max="99999" step="1" v-model="new_quantity">
        <br/><br/>
      </div>
      <div id=product-category>
        <label>Categoria:</label>
        <a> {{current_category}} </a>
        <br/><br/>
      </div>
      <div id=product-description>
        <label>Descrição:</label>
        <a v-if="is_editing === false"> {{current_description}} </a>
        <input v-if="is_editing === true" type="text" v-model="new_description">
        <br/><br/>
      </div>
    </div>
    <div id="edit-update-cancel-buttons">
      <button v-if="((is_editing === false) && ($root.loginRole <= managerRole))" class="edit-btn" @click="editProduct()">Editar</button>
      <button v-if="is_editing === true" class="update-btn" @click="updateProduct()">Atualizar</button>
      <button v-if="is_editing === true" class="cancel-btn" @click="cancelUpdate()">Cancelar</button>
    </div>
  </div>
</template>

<script>
  import * as common from '../utils/common';
  import roles from '../utils/roles';
  import Message from './Message';

  export default {
    name: "ProductDetailsComponent",
    props: {
      product_id_input_parameter : String
    },
    data() {
      return {
        managerRole: roles.roles.MANAGER,
        current_id: '',
        current_name: '',
        new_name: '',
        current_state: '',
        new_state: '',
        current_price: '',
        new_price: '',
        current_quantity: '',
        new_quantity: '',
        current_category: '',
        current_description: '',
        new_description: '',
        is_editing: false,
        msg: '',
        categories: null
      }
    },
    methods: {
      getCategoryNameById(category_id) {
        for (let i = 0; i < this.categories.length; i++) {
          if (this.categories[i].categoryid === category_id) {
            return this.categories[i].name;
          }
        }
        return null;
      },
      async getCategories()
      {
        try {
          const res = await common.getCategories(this);
          this.categories = res.categories;

        } catch (error) {
          console.log(`Error: ${error}`);
        }
      },
      async getProductDetails()
      {
        try {
          const req = await fetch("http://localhost:3000/products/" + this.current_id, {
            method: "GET",
            headers: { "Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken }
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.current_name = res.name;
          this.new_name = res.name;
          this.current_state = res.state;
          this.new_state = res.state;
          this.current_price = res.price;
          this.new_price = res.price;
          this.current_quantity = res.quantity;
          this.new_quantity = res.quantity;
          this.current_category = this.getCategoryNameById(res.categoryid);
          this.current_description = res.description;
          this.new_description = res.description;

        } catch (error) {
          console.log(`Error: ${error}`);
        }
      },
      async editProduct()
      {
        this.is_editing = true;
      },
      async cancelUpdate()
      {
        this.is_editing = false;
        this.new_name = this.current_name;
        this.new_state = this.current_state;
        this.new_price = this.current_price;
        this.new_quantity = this.current_quantity;
        this.new_description = this.current_description;
      },
      async updateProduct()
      {
        const data = { name: this.new_name, state: this.new_state, price: this.new_price,
           quantity: this.new_quantity, description: this.new_description };
        const dataJson = JSON.stringify(data);

        try {
          const req = await fetch("http://localhost:3000/products/" + this.current_id, {
            method: "PATCH",
            headers: {"Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken},
            body: dataJson
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.msg = "Produto " + this.current_id + " atualizado com sucesso!";
          this.current_name = res.name;
          this.current_state = res.state;
          this.current_price = res.price;
          this.current_quantity = res.quantity;
          this.current_description = res.description;
          this.is_editing = false;

        } catch (error) {
          this.msg = `Error: ${error}`;
        }

        setTimeout(() => this.msg = "", 3000);
      }
    },
    components: {
      Message
    },
    async mounted()
    {
      this.current_id = this.product_id_input_parameter;
      await this.getCategories();
      await this.getProductDetails();
    }
  }
</script>

<style scoped>
  #product-details {
    max-width: 600px;
    margin: 0 auto;
  }
  #edit-update-cancel-buttons {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
  }
  label {
    font-size: 20px;
    font-weight: bold;
    line-height: 26px;
    margin-bottom: 15px;
    color: #222;;
    padding: 5px 10px;
    border-left: 4px solid #fcba03;
  }
  a {
    font-size: 20px;
  }
  input {
    font-size: 20px;
    padding: 5px 10px;
    width: 450px;
  }
  #product-quantity input {
    width: 100px;
  }
  #product-price input {
    width: 150px;
  }
  #opcionais-container {
    flex-direction: row;
    flex-wrap: wrap;
  }
  #opcionais-title {
    width: 100%;
  }
  button {
    background-color: #222;
    color:#fcba03;
    font-weight: bold;
    border: 2px solid #222;
    padding: 10px;
    font-size: 32px;
    margin: 10px 10px;
    cursor: pointer;
    transition: .5s;
  }
  button:hover {
    background-color: transparent;
    color: #222;
  }
  .radio-button-label {
    display: inline;
    font-size: 20px;
    font-weight: normal;
    line-height: 13px;
    padding: 0px 0px;
    border-left: 0px solid transparent;
    width: 20%;
  }
  #product-state input {
    display: inline;
    font-size: 10px;
    font-weight: normal;
    line-height: 13px;
    padding: 0px 0px;
    border-left: 0px solid transparent;
    width: 10%;
  }
</style>
