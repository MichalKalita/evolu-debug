<script setup lang="ts">
import Tables from './components/Tables.vue';
import TableDetail from './components/TableDetail.vue';
import { ref } from 'vue';

const showMain = ref(false);
const selectedTable = ref<string | null>(null);

const toggleMain = () => {
  showMain.value = !showMain.value;

  if (!showMain.value) {
    selectedTable.value = null;
  }
}

const openTableDetail = (tableName: string) => {
  selectedTable.value = tableName;
};

const closeTableDetail = () => {
  selectedTable.value = null;
};
</script>

<template>
  <button class="floating-button" @click="toggleMain">
    {{ showMain ? 'Close Evolu Debug' : 'Open Evolu Debug' }}
  </button>
  <Tables v-if="showMain && !selectedTable" @select-table="openTableDetail" />
  <TableDetail
    v-else-if="showMain && selectedTable"
    :table-name="selectedTable"
    @back="closeTableDetail"
  />
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
