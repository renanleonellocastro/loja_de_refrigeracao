<template>
  <div id="client-table" v-if="clients !== null">
    <div>
      <div id="client-table-heading">
        <div>Cliente:</div>
        <div>E-mail:</div>
        <div>Telefone:</div>
        <div>Endereço:</div>
        <div>Cidade:</div>
      </div>
    </div>
    <div id="client-table-rows">
      <div class="client-table-row" v-for="client in clients" :key="client.userid">
        <div>{{ client.name }}</div>
        <div>{{ client.email }}</div>
        <div>{{ client.phone }}</div>
        <div>{{ client.address }}</div>
        <div>{{ client.city }}</div>
        <div id="update-delete-buttons">
          <button class="update-btn" @click="updateClient(client.cpf)">Editar</button>
          <button class="delete-btn" @click="deleteClient(client.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <h2>Não há clientes no momento!</h2>
  </div>
</template>
<script>
  import * as common from '../utils/common';

  export default {
    name: "ClientsList",
    data() {
      return {
        clients: null
      }
    },
    methods: {
      async getClients()
      {
        try {
          const req = await fetch("http://localhost:3000/users", {
            method: "GET",
            headers: { "Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken }
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.clients = res.users;

        } catch (error) {
          console.log(`Error: ${error}`);
        }
      },
      async deleteClient(cpf)
      {
        try {
          const req = await fetch(`http://localhost:3000/users/${cpf}`, {
            method: "DELETE",
            headers: { "Content-Type" : "application/json" }
          });

          if (!req.ok) {
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.getClients();

        } catch (error) {
          console.log(`Error: ${error}`);
        }
      },
      async updateClient(event, cpf)
      {
        console.log("Not implemented yet!")
      }
    },
    async mounted()
    {
      await this.getClients();
    }
  }
</script>

<style scoped>
  #client-table
  {
    max-width: 1300px;
    margin: 0 auto;
  }

  #client-table-heading,
  #client-table-rows,
  .client-table-row
  {
    display: flex;
    flex-wrap: wrap;
    padding: 10px;
  }

  #client-table-heading>*,
  .client-table-row>* {
    flex: 0 0 16%;
  }

  #update-delete-buttons {
    padding: 5px;
    display: flex;
    flex-grow: 1;
    justify-content: center;
  }

  #client-table-heading
  {
    font-weight: bold;
    padding: 12px;
    border-bottom: 3px solid #333;
  }

  .client-table-row
  {
    width: 100%;
    padding: 12px;
    border-bottom: 1px solid #CCC;
  }

  #client-table-heading div,
  .client-table-row div
  {
    width: 19%;
  }

  .delete-btn,
  .update-btn
  {
    margin-right: 5px;
    background-color: #222;
    color:#fcba03;
    font-weight: bold;
    border: 2px solid #222;
    padding: 10px;
    font-size: 16px;
    cursor: pointer;
    transition: .5s;
    flex-grow: 1;
  }
  
  .delete-btn:hover,
  .update-btn:hover
  {
    background-color: transparent;
    color: #222;
  }
  
</style>