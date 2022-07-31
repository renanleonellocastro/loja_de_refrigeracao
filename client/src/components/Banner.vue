<template>
  <div id="main-banner">
    <h1>Ar Condicionado</h1>
  </div>
</template>

<script>
  export default {
    name: "Banner"
  }
</script>

<style scoped>

  #main-banner {
    background-image: url('../../public/img/home.jpg');
    background-position: 0 - 100px;
    background-size: cover;
    height: 700px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  #main-banner h1 {
    color: #FFF;
    text-align: center;
    font-size: 60px;
    background-color: rgb(140, 140, 140);
    padding: 20px 40px;
  }

</style>
