<script setup lang="ts">
import type { Evolu } from '@evolu/common'
import { inject, onMounted, ref } from 'vue'

const emit = defineEmits<{
  (event: 'select-table', tableName: string): void
}>()

const evolu = inject<Evolu>('evolu')

if (!evolu) {
  throw new Error('Evolu instance is not provided')
}

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const tables = ref<string[]>([])

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
    <h1>Evolu Debug</h1>

    <p v-if="isLoading">Loading tables...</p>
    <p v-else-if="loadError">Failed to load tables: {{ loadError }}</p>

    <ul v-else>
      <li v-for="table in tables" :key="table">
        <button
          type="button"
          class="table-link"
          @click="emit('select-table', table)"
        >
          {{ table }}
        </button>
      </li>
    </ul>
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
}

.table-link {
  border: none;
  background: none;
  padding: 0;
  color: #0366d6;
  cursor: pointer;
  text-decoration: underline;
  font: inherit;
}
</style>
