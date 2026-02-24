<script setup lang="ts">
import type { Evolu } from '@evolu/common'
import { computed, inject, onMounted, ref } from 'vue'

const props = defineProps<{
  tableName: string
}>()

const emit = defineEmits<{
  (event: 'back'): void
}>()

const evolu = inject<Evolu>('evolu')

if (!evolu) {
  throw new Error('Evolu instance is not provided')
}

type RowData = Record<string, unknown>

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const rows = ref<RowData[]>([])

const columns = computed(() => {
  const keys = new Set<string>()

  for (const row of rows.value) {
    for (const key of Object.keys(row)) {
      keys.add(key)
    }
  }

  return Array.from(keys)
})

const getQueryRows = (result: unknown): RowData[] => {
  if (Array.isArray(result)) return result as RowData[]

  if (
    typeof result === 'object' &&
    result !== null &&
    'rows' in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as RowData[]
  }

  return []
}

const formatCell = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

onMounted(() => {
  const query = evolu.createQuery((db) =>
    (db as unknown as { selectFrom: (table: string) => any })
      .selectFrom(props.tableName)
      .selectAll(),
  )

  evolu
    .loadQuery(query)
    .then((result) => {
      rows.value = getQueryRows(result)
    })
    .catch((error: unknown) => {
      loadError.value = error instanceof Error ? error.message : String(error)
    })
    .finally(() => {
      isLoading.value = false
    })
})
</script>

<template>
  <div id="evolu-debug-root">
    <button type="button" class="back-button" @click="emit('back')">
      Back to tables
    </button>

    <h1>Table Detail</h1>
    <h2>{{ props.tableName }}</h2>

    <p v-if="isLoading">Loading rows...</p>
    <p v-else-if="loadError">Failed to load rows: {{ loadError }}</p>
    <p v-else-if="rows.length === 0">No rows found.</p>

    <div v-else class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
            <td v-for="column in columns" :key="column">
              {{ formatCell(row[column]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
#evolu-debug-root {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: #fff;
  z-index: 1000000;
  color: black;
  padding: 20px;
  box-sizing: border-box;
  overflow: auto;
}

.back-button {
  border: 1px solid #d0d7de;
  background-color: #f6f8fa;
  color: #24292f;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  margin-bottom: 16px;
}

.table-wrapper {
  overflow: auto;
  max-height: calc(100vh - 180px);
  border: 1px solid #d0d7de;
  border-radius: 6px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

th,
td {
  border-bottom: 1px solid #d0d7de;
  padding: 8px 10px;
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
