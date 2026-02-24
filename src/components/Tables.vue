<script setup lang="ts">
import { useEvolu, useQuery } from '@evolu/vue'
import { computed, watch } from 'vue'
import { sortTables, splitTables } from '../lib/utils'

const props = defineProps<{
  selectedTable: string | null
}>()

const emit = defineEmits<{
  (event: 'select-table', tableName: string): void
  (event: 'tables-loaded', tableNames: string[]): void
}>()

const evolu = useEvolu()

type TableRow = { name: string | null }

const tablesQuery = evolu.createQuery((db) =>
  db
    .selectFrom('sqlite_schema')
    .select(['name'])
    .where('type', '=', 'table')
    .where('name', 'is not', null)
    .where('name', 'not like', 'sqlite_%')
    .orderBy('name'),
)

const tableRows = useQuery(tablesQuery)

const tables = computed(() =>
  sortTables(
    (tableRows.value as ReadonlyArray<TableRow>)
      .map((row) => row.name)
      .filter((name): name is string => Boolean(name)),
  ),
)

const groupedTables = computed(() => splitTables(tables.value))
const regularTables = computed(() => groupedTables.value.regularTables)
const evoluInternalTables = computed(() => groupedTables.value.evoluInternalTables)

watch(
  tables,
  (tableNames) => {
    emit('tables-loaded', [...tableNames])
  },
  { immediate: true },
)
</script>

<template>
  <div class="tables-panel">
    <h2>Application Tables</h2>

    <ul>
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
