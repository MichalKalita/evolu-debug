<script setup lang="ts">
import { computed } from 'vue'
import { formatSchemaType, inferColumnDataType, type RowData } from '../lib/utils'

const props = defineProps<{
  columns: Readonly<Record<string, unknown>> | null
  rows: ReadonlyArray<RowData>
}>()

const schemaColumns = computed(() => {
  if (!props.columns) return []

  return Object.entries(props.columns).map(([name, definition]) => ({
    name,
    definition,
    dataType: inferColumnDataType(props.rows, name),
  }))
})
</script>

<template>
  <div class="schema-wrapper">
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
</template>

<style scoped>
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
