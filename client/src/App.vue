<template>
  <div>
    <Navbar :logo="logo_src" :alt="app_name" />
    <div>
      <router-view></router-view>
    </div>
    <Footer/>
  </div>
</template>
<script>
import Navbar from './components/Navbar'
import Footer from './components/Footer'

export default {
  data: function() {
    return {
      logo_src: "/img/logo.png",
      app_name: "Refrigeracao Castro Client",
      loginUserID: localStorage.userid ? localStorage.userid : '',
      loginName: localStorage.name ? localStorage.name : '',
      loginToken: localStorage.token ? localStorage.token : '',
      loginRole: localStorage.role ? localStorage.role : 999
    }
  },
  methods: {
    setUserID(userid)
    {
      this.loginUserID = userid;
      localStorage.userid = this.loginUserID;
    },
    setName(name)
    {
      this.loginName = name;
      localStorage.name = this.loginName;
    },
    setToken(token)
    {
      this.loginToken = token;
      localStorage.token = this.loginToken;
    },
    setRole(role)
    {
      this.loginRole = role;
      localStorage.role = this.loginRole;
    },
    getUserID()
    {
      return this.loginUserID;
    },
    getName()
    {
      return this.loginName;
    },
    getToken()
    {
      return this.loginToken;
    },
    getRole()
    {
      return this.loginRole;
    }
  },
  components: {
    Navbar,
    Footer
  }
}
</script>

<style>
  * {
    font-family: Helvetica;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
  }

  .main-container {
    margin: 50px;
    min-height: 250px;
  }

  h1 {
    text-align: center;
    font-size: 42px;
    margin-bottom: 30px;
    color: #222;
  }
</style>
