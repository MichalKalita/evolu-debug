<script setup lang="ts">
import type { Evolu } from '@evolu/common'
import { computed, inject, ref, watch } from 'vue'

const props = defineProps<{
  tableName: string
}>()

const evolu = inject<Evolu>('evolu')

if (!evolu) {
  throw new Error('Evolu instance is not provided')
}

type RowData = Record<string, unknown>

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const rows = ref<RowData[]>([])
const schemaSql = ref<string>('')
const selectedView = ref<'data' | 'schema'>('data')

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

const loadTableDetail = () => {
  isLoading.value = true
  loadError.value = null
  rows.value = []
  schemaSql.value = ''

  const query = evolu.createQuery((db) =>
    (db as unknown as { selectFrom: (table: string) => any })
      .selectFrom(props.tableName)
      .selectAll(),
  )

  const schemaQuery = evolu.createQuery((db) =>
    (db as unknown as { selectFrom: (table: string) => any })
      .selectFrom('sqlite_schema')
      .select(['sql'])
      .where('type', '=', 'table')
      .where('name', '=', props.tableName)
      .limit(1),
  )

  Promise.all([evolu.loadQuery(query), evolu.loadQuery(schemaQuery)])
    .then(([rowsResult, schemaResult]) => {
      rows.value = getQueryRows(rowsResult)

      const schemaRows = getQueryRows(schemaResult)
      const sql = schemaRows[0]?.sql
      schemaSql.value = typeof sql === 'string' ? sql : 'Schema not found'
    })
    .catch((error: unknown) => {
      loadError.value = error instanceof Error ? error.message : String(error)
    })
    .finally(() => {
      isLoading.value = false
    })
}

watch(
  () => props.tableName,
  () => {
    selectedView.value = 'data'
    loadTableDetail()
  },
  { immediate: true },
)
</script>

<template>
  <div class="detail-panel">
    <h1>Table Detail</h1>
    <h2>{{ props.tableName }}</h2>

    <div class="view-switch">
      <button
        type="button"
        :class="['switch-btn', { 'is-active': selectedView === 'data' }]"
        @click="selectedView = 'data'"
      >
        Data
      </button>
      <button
        type="button"
        :class="['switch-btn', { 'is-active': selectedView === 'schema' }]"
        @click="selectedView = 'schema'"
      >
        Schema
      </button>
    </div>

    <p v-if="isLoading">Loading rows...</p>
    <p v-else-if="loadError">Failed to load rows: {{ loadError }}</p>

    <pre v-else-if="selectedView === 'schema'" class="schema-box">{{ schemaSql }}</pre>

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
.detail-panel {
  color: #111827;
}

h1 {
  margin: 0;
  font-size: 16px;
}

h2 {
  margin: 4px 0 10px;
  font-size: 13px;
  color: #6b7280;
}

.view-switch {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 10px;
}

.switch-btn {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  border-radius: 4px;
  padding: 5px 9px;
  cursor: pointer;
  font-size: 12px;
}

.switch-btn.is-active {
  background: #e0e7ff;
  color: #1d4ed8;
  border-color: #93c5fd;
}

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

.schema-box {
  margin: 0;
  padding: 10px;
  background: #111827;
  color: #f3f4f6;
  border-radius: 4px;
  overflow: auto;
  font-size: 12px;
}
</style>
