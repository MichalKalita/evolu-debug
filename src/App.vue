<script setup lang="ts">
import Main from './components/Main.vue';
import { ref } from 'vue';

const showMain = ref(false);

const toggleMain = () => {
  showMain.value = !showMain.value;
}
</script>

<template>
  <button class="floating-button" @click="toggleMain">
    {{ showMain ? 'Close Evolu Debug' : 'Open Evolu Debug' }}
  </button>
  <Main v-if="showMain" />
</template>

<style scoped>
.floating-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #000;
  color: #fff;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
  z-index: 1000010;
}
</style>
