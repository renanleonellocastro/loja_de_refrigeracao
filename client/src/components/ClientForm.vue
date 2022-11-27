<template>
  <Message :msg="msg" v-show="msg" />
  <div>
    <form id="client-form" method="POST" @submit="createClient">
      <div class="input-container">
        <label for="name">Nome do cliente:</label>
        <input type="text" id="name" name="name" v-model="name" placeholder="Ex.: João Rodrigues">
      </div>
      <div class="input-container">
        <label for="cpf">CPF do cliente:</label>
        <input type="text" id="cpf" name="cpf" v-model="cpf" placeholder="Ex.: 12345678900">
      </div>
      <div class="input-container">
        <label for="email">E-mail do cliente:</label>
        <input type="text" id="email" name="email" v-model="email" placeholder="Ex.: joao_rodrigues@gmail.com">
      </div>
      <div class="input-container">
        <label for="phone">Telefone do cliente:</label>
        <input type="text" id="phone" name="phone" v-model="phone" placeholder="Ex.: 19912233445">
      </div>
      <div class="input-container">
        <label for="address">Endereço do cliente:</label>
        <input type="text" id="address" name="address" v-model="address" placeholder="Ex.: Rua Dos Alfaces 867, Apartamento 200, Bloco D">
      </div>
      <div class="input-container">
        <label for="city">Cidade do cliente:</label>
        <input type="text" id="city" name="city" v-model="city" placeholder="Ex.: Mogi Mirim">
      </div>
      <div class="input-container">
        <input class="submit-btn" type="submit" value="Cadastrar Cliente!">
      </div>
    </form>
  </div>
</template>

<script>
import * as common from '../utils/common';
import Message from './Message'

export default {
  name: "ClientForm",
  data() {
    return {
      name: null,
      cpf: null,
      email: null,
      phone: null,
      address: null,
      city: null,
      msg: null
    }
  },
  methods: {
    async createClient(e)
    {
      e.preventDefault();

      const data = { name: this.name, cpf: this.cpf, email: this.email, phone: this.phone, address: this.address,
        city: this.city, password: 'doesnothave' };
      const dataJson = JSON.stringify(data);

        try {
          const req = await fetch("http://localhost:3000/users", {
            method: "POST",
            headers: {"Content-Type" : "application/json"},
            body: dataJson
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.msg = "Cliente " + this.name + " cadastrado com sucesso!";
          this.clearData();

        } catch (error) {
          this.msg = `Error: ${error}`;
        }

        setTimeout(() => this.msg = "", 3000);
    },
    clearData()
    {
      this.name = "";
      this.cpf = "";
      this.email = "";
      this.phone = "";
      this.address = "";
      this.city = "";
    }
  },
  components: {
    Message
  }
}
</script>

<style scoped>
  #client-form {
    max-width: 400px;
    margin: 0 auto;
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
