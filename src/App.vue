<script setup lang="ts">
import TitleBar from "./components/TitleBar.vue";
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <router-view />
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

#app {
  height: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
</style>
