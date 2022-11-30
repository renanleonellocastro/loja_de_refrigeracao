<template>
  <Message :msg="msg" v-show="msg" />
  <div>
    <form id="login-form" method="POST" @submit="login">
      <div class="input-container">
        <label for="email">E-mail:</label>
        <input type="text" id="email" name="email" v-model="email" placeholder="Ex.: joao_rodrigues@gmail.com">
      </div>
      <div class="input-container">
        <label for="password">Senha:</label>
        <input type="password" id="password" name="password" v-model="password" placeholder="Ex.: ***********">
      </div>
      <div class="input-container">
        <input class="submit-btn" type="submit" value="Login">
      </div>
    </form>
  </div>
</template>

<script>
import * as common from '../utils/common'
import Message from './Message'
import router from '@/router'

export default {
  name: "LoginForm",
  data() {
    return {
      email: null,
      password: null,
      msg: null
    }
  },
  methods: {
    clearLocalVariables()
    {
      this.email = null;
      this.password = null;
      this.msg = null;
    },
    async login(e)
    {
      e.preventDefault();

      const dataJson = JSON.stringify({ email: this.email, password: this.password});  

      try {
        const req = await fetch("http://localhost:3000/users/login", {
          method: "POST",
          headers: { "Content-Type" : "application/json" },
          body: dataJson
        });

        if (!req.ok) {
          this.msg = "Usuário ou senha inválidos!";
          throw new Error(`Error! status: ${req.status}`);
        }

        const res = await req.json();
        common.login(this, res.userid, res.name.split(' ')[0], res.token, res.role);
        this.clearLocalVariables();
        router.push('/');

      } catch (error) {
        if (this.msg === null) {
          this.msg = "Falha no servidor de autenticação!";
        }
      }
    }
  },
  components: {
    Message
  }
}
</script>

<style scoped>
  #login-form 
  {
    max-width: 400px;
    margin: 0 auto;
  }

  .input-container 
  {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
  }

  label 
  {
    font-weight: bold;
    margin-bottom: 15px;
    color: #222;;
    padding: 5px 10px;
    border-left: 4px solid #fcba03;
  }

  input, select 
  {
    padding: 5px 10px;
    width: 300px;
  }

  .submit-btn 
  {
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

  .submit-btn:hover 
  {
    background-color: transparent;
    color: #222;
  }
</style>
