<script setup>
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <div class="app-container">
    <img id="logo" alt="FlexViword logo" src="./assets/images/logo-universal.png"/>
    <HelloWorld/>
  </div>
</template>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
  min-height: 100vh;
  box-sizing: border-box;
}

#logo {
  display: block;
  width: 120px;
  height: auto;
  margin-bottom: 30px;
  filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.4));
  transition: transform 0.3s ease;
}

#logo:hover {
  transform: scale(1.05);
}
</style>