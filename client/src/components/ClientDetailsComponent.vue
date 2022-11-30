<template>
  <Message :msg="msg" v-show="msg" />
  <div>
    <div id="client-details">
      <div id=client-id>
        <label>ID:</label>
        <a> {{current_id}} </a>
        <br/><br/>
      </div>
      <div id=client-name>
        <label>Nome:</label>
        <a v-if="is_editing === false"> {{current_name}} </a>
        <input v-if="is_editing === true" type="text" v-model="new_name">
        <br/><br/>
      </div>
      <div id=client-email>
        <label>E-mail:</label>
        <a v-if="is_editing === false"> {{current_email}} </a>
        <input v-if="is_editing === true" type="text" v-model="new_email">
        <br/><br/>
      </div>
      <div id=client-cpf>
        <label>CPF:</label>
        <a> {{current_cpf}} </a>
        <br/><br/>
      </div>
      <div id=client-phone>
        <label>Telefone:</label>
        <a v-if="is_editing === false"> {{current_phone}} </a>
        <input v-if="is_editing === true" type="text" v-model="new_phone">
        <br/><br/>
      </div>
      <div id=client-address>
        <label>Endereço:</label>
        <a v-if="is_editing === false"> {{current_address}} </a>
        <input v-if="is_editing === true" type="text" v-model="new_address">
        <br/><br/>
      </div>
      <div id=client-city>
        <label>Cidade:</label>
        <a v-if="is_editing === false"> {{current_city}} </a>
        <input v-if="is_editing === true" type="text" v-model="new_city">
        <br/><br/>
      </div>
    </div>
    <div id="edit-update-cancel-buttons">
      <button v-if="is_editing === false" class="edit-btn" @click="editClient()">Editar</button>
      <button v-if="is_editing === true" class="update-btn" @click="updateClient()">Atualizar</button>
      <button v-if="is_editing === true" class="cancel-btn" @click="cancelUpdate()">Cancelar</button>
    </div>
  </div>
</template>

<script>
  import * as common from '../utils/common';
  import Message from './Message'

  export default {
    name: "ClientDetailsComponent",
    props: {
      user_id_input_parameter : String
    },
    data() {
      return {
        current_id: '',
        current_name: '',
        new_name: '',
        current_email: '',
        new_email: '',
        current_cpf: '',
        current_phone: '',
        new_phone: '',
        current_address: '',
        new_address: '',
        current_city: '',
        new_city: '',
        is_editing: false,
        msg: ''
      }
    },
    methods: {
      async getClientDetails()
      {
        try {
          const req = await fetch("http://localhost:3000/users/" + this.current_id, {
            method: "GET",
            headers: { "Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken }
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.current_cpf = res.cpf;
          this.current_name = res.name;
          this.new_name = res.name;
          this.current_email = res.email;
          this.new_email = res.email;
          this.current_address = res.address;
          this.new_address = res.address;
          this.current_city = res.city;
          this.new_city = res.city;
          this.current_phone = res.phone;
          this.new_phone = res.phone;

        } catch (error) {
          console.log(`Error: ${error}`);
        }
      },
      async editClient()
      {
        this.is_editing = true;
      },
      async cancelUpdate()
      {
        this.is_editing = false;
        this.new_name = this.current_name;
        this.new_email = this.current_email;
        this.new_address = this.current_address;
        this.new_city = this.current_city;
        this.new_phone = this.current_phone;
      },
      async updateClient()
      {
        const data = { name: this.new_name, email: this.new_email, phone: this.new_phone, address: this.new_address,
        city: this.new_city };
        const dataJson = JSON.stringify(data);

        try {
          const req = await fetch("http://localhost:3000/users/" + this.current_id, {
            method: "PATCH",
            headers: {"Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken},
            body: dataJson
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.msg = "Cliente " + this.current_id + " atualizado com sucesso!";
          this.current_name = res.name;
          this.current_email = res.email;
          this.current_address = res.address;
          this.current_city = res.city;
          this.current_phone = res.phone;
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
      this.current_id = this.user_id_input_parameter ? this.user_id_input_parameter : this.$root.getUserID();
      await this.getClientDetails();
    }
  }
</script>

<style scoped>
  #client-details {
    max-width: 600px;
    margin: 0 auto;
  }
  #edit-update-cancel-buttons {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
  }
  .input-container {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
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
</style>
