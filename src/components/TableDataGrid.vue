<script setup lang="ts">
import { computed } from 'vue'
import { formatCell, type RowData } from '../lib/utils'

const props = defineProps<{
  rows: ReadonlyArray<RowData>
}>()

const columns = computed(() => {
  const keys = new Set<string>()

  for (const row of props.rows) {
    for (const key of Object.keys(row)) {
      keys.add(key)
    }
  }

  return Array.from(keys)
})
</script>

<template>
  <p v-if="props.rows.length === 0">No rows found.</p>

  <div v-else class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in props.rows" :key="rowIndex">
          <td v-for="column in columns" :key="column">
            {{ formatCell(row[column]) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrapper {
  overflow: auto;
  max-height: calc(100vh - 145px);
  border: 1px solid #d0d7de;
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
  font-size: 12px;
}

th,
td {
  border-bottom: 1px solid #d0d7de;
  padding: 5px 7px;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: #f6f8fa;
}
</style>
