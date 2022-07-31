<template>
  <div>
    <div id="nav">
      <router-link id="logo-url" to="/">
        <img id="logo" :src="logo" :alt="alt">
      </router-link>
      <router-link to="/client">Cadastrar Cliente</router-link>
      <router-link to="/clients">Clientes</router-link>
      <router-link v-if="$root.loginName !== ''" to="/">{{$root.loginName}}</router-link>
      <router-link v-if="$root.loginName !== ''" @click.native="logout" to="/">Logout</router-link>
      <router-link v-else to="/login">Login</router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: "Navbar",
  props: ["logo", "alt"],
  methods: {
    logout()
    {
      this.$root.setName('');
      this.$root.setToken('');
    }
  }
};
</script>

<style scoped>
  #nav {
    background-color: #222;
    border-bottom: 4px solid #111;
    padding: 15px 50px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  #nav #logo-url {
    margin: auto;
    margin-left: 0;
  }

  #logo {
    width: 40px;
    height: 40px;
  }

  #nav a {
    color: #fcba03;
    text-decoration: none;
    margin: 12px;
    transition: .5s;
  }

  #nav a:hover {
    color: #FFF;
  }
</style>