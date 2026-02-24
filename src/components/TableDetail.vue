<script setup lang="ts">
import type { Evolu, EvoluSchema } from '@evolu/common'
import { computed, inject, ref, watch } from 'vue'
import { EvoluDebugEvoluContext, EvoluDebugSchemaContext } from '../context'

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

type RowData = Record<string, unknown>

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const rows = ref<RowData[]>([])
const selectedView = ref<'data' | 'schema'>('data')

type SchemaColumn = { name: string; definition: unknown; dataType: string }

const currentTableSchema = computed(() => {
  const schemaRecord = schema as Record<string, Record<string, unknown>>
  return schemaRecord[props.tableName] ?? null
})

const formatLiteral = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

const formatSchemaType = (
  definition: unknown,
  seen: WeakSet<object> = new WeakSet(),
): string => {
  if (!definition || typeof definition !== 'object') {
    if (typeof definition === 'function') return definition.name || 'Function'
    return 'Unknown'
  }

  if (seen.has(definition)) return '[Recursive]'
  seen.add(definition)

  const typeName = 'name' in definition ? (definition as { name?: unknown }).name : null

  if (typeName === 'Union' && 'members' in definition) {
    const members = (definition as { members?: unknown }).members
    if (Array.isArray(members)) {
      return members.map((member) => formatSchemaType(member, seen)).join(' | ')
    }
  }

  if (typeName === 'Literal' && 'expected' in definition) {
    return formatLiteral((definition as { expected: unknown }).expected)
  }

  if (typeName === 'Brand') {
    const brandName = (definition as { brand?: unknown }).brand
    const parentType = (definition as { parentType?: unknown }).parentType
    if (typeof brandName === 'string') {
      return parentType
        ? `${brandName}<${formatSchemaType(parentType, seen)}>`
        : brandName
    }
  }

  if (typeName === 'Optional' && 'parent' in definition) {
    return `${formatSchemaType((definition as { parent: unknown }).parent, seen)} (optional)`
  }

  if (typeof typeName === 'string' && typeName.length > 0) return typeName

  const constructorName = (definition as { constructor?: { name?: string } }).constructor?.name
  if (constructorName && constructorName !== 'Object') return constructorName

  const ownKeys = Object.getOwnPropertyNames(definition)
  if (ownKeys.length > 0) return `Object(${ownKeys.slice(0, 6).join(', ')})`

  return 'Unknown'
}

const getRuntimeValueType = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return 'bytes'

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    const isBinaryObject =
      entries.length > 0 &&
      entries.every(([key, entryValue]) => {
        const index = Number(key)
        return (
          Number.isInteger(index) &&
          index >= 0 &&
          typeof entryValue === 'number' &&
          Number.isInteger(entryValue) &&
          entryValue >= 0 &&
          entryValue <= 255
        )
      })

    if (isBinaryObject) return 'bytes'
    return 'object'
  }

  return typeof value
}

const inferColumnDataType = (columnName: string): string => {
  const detectedTypes = new Set<string>()

  for (const row of rows.value) {
    if (!(columnName in row)) continue
    detectedTypes.add(getRuntimeValueType(row[columnName]))
  }

  if (detectedTypes.size === 0) return 'no data'
  if (detectedTypes.size === 1) return Array.from(detectedTypes)[0] ?? 'no data'
  return `mixed(${Array.from(detectedTypes).join('|')})`
}

const schemaColumns = computed<SchemaColumn[]>(() => {
  if (!currentTableSchema.value) return []

  return Object.entries(currentTableSchema.value).map(([name, definition]) => ({
    name,
    definition,
    dataType: inferColumnDataType(name),
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

const formatCell = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (value instanceof Uint8Array) {
    const preview = Array.from(value.slice(0, 10))
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
      .join('')

    return `0x${preview} (${value.byteLength} B)`
  }

  if (value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value)
    const preview = Array.from(bytes.slice(0, 10))
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
      .join('')

    return `0x${preview} (${bytes.byteLength} B)`
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
    const isBinaryObject =
      entries.length > 0 &&
      entries.every(([key, entryValue]) => {
        const index = Number(key)
        return (
          Number.isInteger(index) &&
          index >= 0 &&
          index <= 255 &&
          typeof entryValue === 'number' &&
          Number.isInteger(entryValue) &&
          entryValue >= 0 &&
          entryValue <= 255
        )
      })

    if (isBinaryObject) {
      const bytes = entries
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, entryValue]) => entryValue as number)
      const preview = bytes
        .slice(0, 10)
        .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
        .join('')

      return `0x${preview} (${bytes.length} B)`
    }
  }

  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
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
