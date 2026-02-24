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

const handleTablesLoaded = (tableNames: string[]) => {
  if (!selectedTable.value && tableNames.length > 0) {
    selectedTable.value = tableNames[0] ?? null;
  }
};
</script>

<template>
  <button class="floating-button" @click="toggleMain">
    {{ showMain ? 'Close Evolu Debug' : 'Open Evolu Debug' }}
  </button>

  <div v-if="showMain" class="debug-shell">
    <header class="debug-header">
      <h1>Evolu Debug</h1>
      <p>SQLite inspector</p>
    </header>

    <div class="debug-content">
      <aside class="debug-sidebar">
        <Tables
          :selected-table="selectedTable"
          @select-table="openTableDetail"
          @tables-loaded="handleTablesLoaded"
        />
      </aside>

      <main class="debug-main">
        <TableDetail v-if="selectedTable" :key="selectedTable" :table-name="selectedTable" />
        <p v-else class="empty-state">Select a table from the left panel.</p>
      </main>
    </div>
  </div>
</template>

<style scoped>
.floating-button {
  position: fixed;
  bottom: 12px;
  right: 12px;
  background-color: #000;
  color: #fff;
  padding: 7px 10px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 1000010;
  font-size: 13px;
}

.debug-shell {
  position: fixed;
  inset: 0;
  background: #f3f4f6;
  z-index: 1000000;
  color: #111827;
  display: flex;
  flex-direction: column;
}

.debug-header {
  padding: 10px 12px;
  border-bottom: 1px solid #d1d5db;
  background: #ffffff;
}

.debug-header h1 {
  margin: 0;
  font-size: 15px;
}

.debug-header p {
  margin: 3px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.debug-content {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 0;
  flex: 1;
}

.debug-sidebar {
  border-right: 1px solid #d1d5db;
  background: #f9fafb;
  min-height: 0;
}

.debug-main {
  min-height: 0;
  overflow: auto;
  padding: 10px;
  font-size: 13px;
}

.empty-state {
  color: #6b7280;
}
</style>
