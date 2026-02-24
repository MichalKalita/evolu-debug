<script setup lang="ts">
import type { Evolu } from '@evolu/common'
import { computed, inject, onMounted, ref } from 'vue'

const props = defineProps<{
  selectedTable: string | null
}>()

const emit = defineEmits<{
  (event: 'select-table', tableName: string): void
  (event: 'tables-loaded', tableNames: string[]): void
}>()

const evolu = inject<Evolu>('evolu')

if (!evolu) {
  throw new Error('Evolu instance is not provided')
}

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const tables = ref<string[]>([])

const regularTables = computed(() =>
  tables.value.filter((table) => !table.startsWith('evolu_')),
)

const evoluInternalTables = computed(() =>
  tables.value.filter((table) => table.startsWith('evolu_')),
)

type TableRow = { name: string | null }

const getTableRows = (result: unknown): TableRow[] => {
  if (Array.isArray(result)) return result as TableRow[]

  if (
    typeof result === 'object' &&
    result !== null &&
    'rows' in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as TableRow[]
  }

  return []
}

const tablesQuery = evolu.createQuery((db) =>
  db
    .selectFrom('sqlite_schema')
    .select(['name'])
    .where('type', '=', 'table')
    .where('name', 'is not', null)
    .where('name', 'not like', 'sqlite_%')
    .orderBy('name'),
)

onMounted(() => {
  evolu
    .loadQuery(tablesQuery)
    .then((result) => {
      const rows = getTableRows(result)

      tables.value = rows
        .map((row: TableRow) => row.name)
        .filter((name: string | null): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

      emit('tables-loaded', tables.value)
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
  <div class="tables-panel">
    <h2>Application Tables</h2>

    <p v-if="isLoading">Loading tables...</p>
    <p v-else-if="loadError">Failed to load tables: {{ loadError }}</p>

    <ul v-else>
      <li v-for="table in regularTables" :key="table">
        <button
          type="button"
          :class="['table-link', { 'is-active': props.selectedTable === table }]"
          @click="emit('select-table', table)"
        >
          {{ table }}
        </button>
      </li>

      <li v-if="evoluInternalTables.length > 0" class="internal-title">
        Evolu Tables
      </li>

      <li v-for="table in evoluInternalTables" :key="table">
        <button
          type="button"
          :class="['table-link', { 'is-active': props.selectedTable === table }]"
          @click="emit('select-table', table)"
        >
          {{ table }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tables-panel {
  padding: 10px;
  color: #111827;
  font-size: 13px;
}

h2,
.internal-title {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #6b7280;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.table-link {
  border: none;
  background: none;
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  color: #1f2937;
  cursor: pointer;
  text-decoration: none;
  font: inherit;
  border-radius: 4px;
}

.table-link:hover {
  background: #eef2ff;
}

.table-link.is-active {
  background: #e0e7ff;
  color: #1d4ed8;
}

.internal-title {
  margin-top: 10px;
}
</style>
