<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatCell, type RowData } from '../lib/utils'

const props = defineProps<{
  rows: ReadonlyArray<RowData>
  editable?: boolean
}>()

const emit = defineEmits<{
  (event: 'edit-row', row: RowData): void
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

const rowId = (row: RowData): string | null => {
  const id = row.id
  return typeof id === 'string' ? id : null
}

const isRowEditable = (row: RowData): boolean => Boolean(props.editable && rowId(row))

const searchTerm = ref('')
const quickFilter = ref('all')

const clearToolbarFilters = () => {
  searchTerm.value = ''
  quickFilter.value = 'all'
}
</script>

<template>
  <p v-if="props.rows.length === 0">No rows found.</p>

  <div v-else class="table-wrapper">
    <div class="table-toolbar">
      <input
        v-model="searchTerm"
        class="toolbar-input"
        type="text"
        placeholder="Search rows"
        data-testid="data-toolbar-search"
      />

      <select v-model="quickFilter" class="toolbar-select" data-testid="data-toolbar-filter">
        <option value="all">All rows</option>
        <option value="active">Active only</option>
        <option value="deleted">Deleted only</option>
      </select>

      <button type="button" class="toolbar-clear" data-testid="data-toolbar-clear" @click="clearToolbarFilters">
        Clear
      </button>

      <span class="toolbar-count" data-testid="data-toolbar-count">Rows: {{ props.rows.length }}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, rowIndex) in props.rows"
          :key="rowIndex"
          :class="{ 'editable-row': isRowEditable(row) }"
          @click="isRowEditable(row) && emit('edit-row', row)"
        >
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
  max-height: calc(100vh - 170px);
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #fff;
}

.table-toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 140px auto auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.toolbar-input,
.toolbar-select {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
}

.toolbar-clear {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
}

.toolbar-count {
  font-size: 12px;
  color: #6b7280;
  justify-self: end;
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

.editable-row {
  cursor: pointer;
}

.editable-row:hover {
  background: #f8fafc;
}

@media (max-width: 760px) {
  .table-toolbar {
    grid-template-columns: 1fr;
  }

  .toolbar-count {
    justify-self: start;
  }
}
</style>
