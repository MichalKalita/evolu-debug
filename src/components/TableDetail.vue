<script setup lang="ts">
import type { EvoluSchema } from '@evolu/common'
import { useEvolu, useQuery } from '@evolu/vue'
import { computed, inject, ref } from 'vue'
import { EvoluDebugSchemaContext } from '../context'
import type { RowData } from '../lib/utils'
import TableDataGrid from './TableDataGrid.vue'
import TableDetailHeader from './TableDetailHeader.vue'
import TableInsertForm from './TableInsertForm.vue'
import TableSchemaGrid from './TableSchemaGrid.vue'

const props = defineProps<{
  tableName: string
}>()

const evolu = useEvolu()
const schema = inject<EvoluSchema>(EvoluDebugSchemaContext)

if (!schema) {
  throw new Error('Schema is not provided')
}

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const selectedView = ref<'data' | 'schema'>('data')

const currentTableSchema = computed(() => {
  const schemaRecord = schema as Record<string, Record<string, unknown>>
  return schemaRecord[props.tableName] ?? null
})

const canInsertRows = computed(
  () => currentTableSchema.value !== null && !props.tableName.startsWith('evolu_'),
)

const tableQuery = evolu.createQuery((db) =>
  (db as unknown as { selectFrom: (table: string) => any })
    .selectFrom(props.tableName)
    .selectAll(),
)

const tableQueryPromise = evolu.loadQuery(tableQuery)

const tableRows = useQuery(tableQuery, {
  promise: tableQueryPromise,
})

void tableQueryPromise
  .catch((error: unknown) => {
    loadError.value = error instanceof Error ? error.message : String(error)
  })
  .finally(() => {
    isLoading.value = false
  })
</script>

<template>
  <div class="detail-panel">
    <TableDetailHeader
      :table-name="props.tableName"
      :selected-view="selectedView"
      @update:selected-view="selectedView = $event"
    />

    <p v-if="isLoading">Loading rows...</p>
    <p v-else-if="loadError">Failed to load rows: {{ loadError }}</p>

    <TableSchemaGrid v-else-if="selectedView === 'schema'" :columns="currentTableSchema" :rows="tableRows" />

    <template v-else>
      <TableInsertForm v-if="canInsertRows && currentTableSchema" :table-name="props.tableName" :schema-columns="currentTableSchema" />
      <TableDataGrid
        :rows="tableRows"
        :table-name="props.tableName"
        :schema-columns="currentTableSchema"
        :editable="canInsertRows"
      />
    </template>
  </div>
</template>

<style scoped>
.detail-panel {
  color: #111827;
}
</style>
