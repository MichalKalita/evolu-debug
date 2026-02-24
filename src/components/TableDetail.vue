<script setup lang="ts">
import type { Evolu, EvoluSchema } from '@evolu/common'
import { computed, inject, ref, watch } from 'vue'
import { EvoluDebugEvoluContext, EvoluDebugSchemaContext } from '../context'
import {
  formatCell,
  formatSchemaType,
  inferColumnDataType,
  type RowData,
} from '../lib/utils'

const props = defineProps<{
  tableName: string
}>()

const evolu = inject<Evolu>(EvoluDebugEvoluContext)
const schema = inject<EvoluSchema>(EvoluDebugSchemaContext)

if (!evolu) {
  throw new Error('Evolu instance is not provided')
}

if (!schema) {
  throw new Error('Schema is not provided')
}

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const rows = ref<RowData[]>([])
const selectedView = ref<'data' | 'schema'>('data')

type SchemaColumn = { name: string; definition: unknown; dataType: string }

const currentTableSchema = computed(() => {
  const schemaRecord = schema as Record<string, Record<string, unknown>>
  return schemaRecord[props.tableName] ?? null
})

const schemaColumns = computed<SchemaColumn[]>(() => {
  if (!currentTableSchema.value) return []

  return Object.entries(currentTableSchema.value).map(([name, definition]) => ({
    name,
    definition,
    dataType: inferColumnDataType(rows.value, name),
  }))
})

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

const loadTableDetail = () => {
  isLoading.value = true
  loadError.value = null
  rows.value = []

  const query = evolu.createQuery((db) =>
    (db as unknown as { selectFrom: (table: string) => any })
      .selectFrom(props.tableName)
      .selectAll(),
  )

  evolu
    .loadQuery(query)
    .then((rowsResult) => {
      rows.value = getQueryRows(rowsResult)
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
    <h1>{{ props.tableName }}</h1>

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

    <div v-else-if="selectedView === 'schema'" class="schema-wrapper">
      <p v-if="schemaColumns.length === 0" class="schema-missing">
        This table is not present in the provided application schema.
      </p>

      <table v-else>
        <thead>
          <tr>
            <th>Column</th>
            <th>Schema Type</th>
            <th>Data Type</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="column in schemaColumns" :key="column.name">
            <td>{{ column.name }}</td>
            <td>{{ formatSchemaType(column.definition) }}</td>
            <td>{{ column.dataType }}</td>
          </tr>
        </tbody>
      </table>
    </div>

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
  margin: 0 0 10px;
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

.schema-wrapper {
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

.schema-missing {
  margin: 0;
  padding: 10px;
  color: #6b7280;
}
</style>
