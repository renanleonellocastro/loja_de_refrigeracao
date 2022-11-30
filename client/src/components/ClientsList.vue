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
      <div class="client-table-row" v-for="client in clients" :key="client.userid" @click="updateClient(client.userid)">
        <div>{{ client.name }}</div>
        <div>{{ client.email }}</div>
        <div>{{ client.phone }}</div>
        <div>{{ client.address }}</div>
        <div>{{ client.city }}</div>
        <button v-if="$root.loginRole <= managerRole" class="exclude-button" @click.stop.prevent="deleteClient(client.email, client.cpf)">
          <img class="exclude-image" src="../../public/img/exclude_button.png"/>
        </button>
      </div>
    </div>
  </div>
  <div v-else>
    <h2>Não há clientes no momento!</h2>
  </div>
  <confirm-dialogue ref="confirmDialogue"></confirm-dialogue>
</template>
<script>
  import roles from '../utils/roles';
  import * as common from '../utils/common';
  import ConfirmDialogue from '../components/ConfirmationDialogue.vue';

  export default {
    name: "ClientsList",
    data() {
      return {
        managerRole: roles.roles.MANAGER,
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
      async deleteClient(email, cpf)
      {
        try {
          const ok = await this.$refs.confirmDialogue.show({
            title: 'Remover cliente ' + email,
            message: 'Você tem certeza que deseja remover o cliente ' + email + '?',
            okButton: 'Sim',
            cancelButton: "Cancelar"
          });

        if (ok) {
          const dataJson = JSON.stringify({ email: email, cpf: cpf });
          const req = await fetch(`http://localhost:3000/users`, {
            method: "DELETE",
            headers: { "Content-Type" : "application/json", 'Authorization': 'Bearer ' + this.$root.loginToken },
            body: dataJson
          });

          if (!req.ok) {
            common.logoutIfNotAuthorizedAndIsLoggedIn(this, req);
            throw new Error(`Error! status: ${req.status}`);
          }

          const res = await req.json();
          this.getClients();
        }

        } catch (error) {
          console.log(`Error: ${error}`);
        }
      },
      async updateClient(user_id)
      {
        this.$router.push({path: "/clientdetails/" + user_id});
      }
    },
    components: {
      ConfirmDialogue
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
    cursor: pointer;
    transition: .5s;
  }
  .client-table-row:hover, .client-table-row:hover .child
  {
    background-color: #fcba03;
  }
  #client-table-heading div,
  .client-table-row div
  {
    line-height: 40px;
    width: 19%;
  }
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
 .exclude-button {
  margin-right: 5px;
  padding: 10px;
  font-size: 16px;
  cursor: pointer;
  transition: .5s;
  flex-grow: 1;
  border: transparent;
  border-radius: 20px;
  /*background-color: transparent;*/
}
.exclude-button .exclude-image {
  max-width: 50px;
  max-height: 50px;
}
</style>
