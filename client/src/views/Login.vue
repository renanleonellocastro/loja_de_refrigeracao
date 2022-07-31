<template>
  <div>
    <div class="main-container">
      <h1>Login</h1>
      <LoginForm/>
    </div>
  </div>
</template>

<script>
import LoginForm from '../components/LoginForm'

export default {
  name: 'Login',
  components: {
    LoginForm
  }
}
</script>