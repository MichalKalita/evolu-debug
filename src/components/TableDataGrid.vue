<script setup lang="ts">
import { useEvolu, useQuery } from '@evolu/vue'
import { computed, ref, watch } from 'vue'
import {
  buildInsertFields,
  formatCell,
  isBinaryObject,
  parseInsertFieldValue,
  type InsertFieldConfig,
  type RowData,
  type SchemaColumns,
} from '../lib/utils'

const props = defineProps<{
  rows: ReadonlyArray<RowData>
  tableName?: string
  schemaColumns?: SchemaColumns | null
  editable?: boolean
}>()

const evolu = useEvolu()

const columns = computed(() => {
  const keys = new Set<string>()

  for (const row of props.rows) {
    for (const key of Object.keys(row)) {
      keys.add(key)
    }
  }

  return Array.from(keys)
})

const isEditable = computed(() =>
  Boolean(props.editable && props.schemaColumns && props.tableName && !props.tableName.startsWith('evolu_')),
)

type ReferenceOption = { value: string; label: string }

const fields = computed(() =>
  props.schemaColumns ? buildInsertFields(props.schemaColumns) : [],
)

const referenceFieldRows = new Map<string, Readonly<{ value: ReadonlyArray<Record<string, unknown>> }>>()

for (const field of fields.value) {
  if (!field.referenceTable) continue

  const query = evolu.createQuery((db) =>
    (db as unknown as { selectFrom: (table: string) => any })
      .selectFrom(field.referenceTable as string)
      .selectAll()
      .where('isDeleted', 'is not', 1)
      .where('id', 'is not', null)
      .orderBy('createdAt'),
  )

  const initialLoad = evolu.loadQuery(query)
  const rows = useQuery(query, { promise: initialLoad })
  referenceFieldRows.set(field.name, rows)
}

const getFieldOptions = (field: InsertFieldConfig): ReferenceOption[] => {
  const options: ReferenceOption[] = []

  if (!field.required) {
    options.push({ value: '', label: 'null' })
  }

  if (field.referenceTable) {
    const rowsRef = referenceFieldRows.get(field.name)
    const rows = (rowsRef?.value ?? []) as ReadonlyArray<Record<string, unknown>>

    for (const row of rows) {
      const id = row.id
      if (typeof id !== 'string') continue

      const label =
        (typeof row.name === 'string' && row.name.trim().length > 0
          ? row.name
          : typeof row.title === 'string' && row.title.trim().length > 0
            ? row.title
            : id)

      options.push({ value: id, label })
    }

    return options
  }

  for (const option of field.options) {
    options.push({ value: option, label: option })
  }

  return options
}

const editingRowId = ref<string | null>(null)
const editValues = ref<Record<string, string | boolean>>({})
const updateError = ref<string | null>(null)
const updateSuccess = ref<string | null>(null)

const rowId = (row: RowData): string | null => {
  const id = row.id
  return typeof id === 'string' ? id : null
}

const isRowEditable = (row: RowData): boolean => isEditable.value && rowId(row) !== null

const normalizeHexValue = (value: unknown): string => {
  if (value instanceof Uint8Array) {
    return Array.from(value)
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
      .join('')
  }

  if (isBinaryObject(value)) {
    return Object.entries(value)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, byte]) => Number(byte).toString(16).toUpperCase().padStart(2, '0'))
      .join('')
  }

  return ''
}

const startEdit = (row: RowData) => {
  const id = rowId(row)
  if (!id) return

  editingRowId.value = id
  updateError.value = null
  updateSuccess.value = null

  const nextValues: Record<string, string | boolean> = {}

  for (const field of fields.value) {
    const value = row[field.name]

    if (field.type === 'checkbox') {
      nextValues[field.name] = value === 1 || value === true
      continue
    }

    if (field.type === 'hex') {
      nextValues[field.name] = normalizeHexValue(value)
      continue
    }

    if (field.type === 'select') {
      nextValues[field.name] = value == null ? '' : String(value)
      continue
    }

    nextValues[field.name] = value == null ? '' : String(value)
  }

  editValues.value = nextValues
}

const cancelEdit = () => {
  editingRowId.value = null
  editValues.value = {}
}

const setEditValue = (field: InsertFieldConfig, value: string | boolean) => {
  editValues.value[field.name] = value
}

const updateRow = async () => {
  updateError.value = null
  updateSuccess.value = null

  if (!props.tableName || !editingRowId.value) return

  try {
    const payload: Record<string, unknown> = { id: editingRowId.value }

    for (const field of fields.value) {
      const rawValue = editValues.value[field.name] ?? ''
      payload[field.name] = parseInsertFieldValue(field, rawValue)
    }

    const result = await Promise.resolve(evolu.update(props.tableName as never, payload as never))

    if (
      typeof result === 'object' &&
      result !== null &&
      'ok' in result &&
      (result as { ok: boolean }).ok === false
    ) {
      throw (result as { error?: unknown }).error ?? new Error('Update failed')
    }

    updateSuccess.value = 'Row updated.'
    cancelEdit()
  } catch (error: unknown) {
    updateError.value = error instanceof Error ? error.message : String(error)
  }
}

watch(
  () => props.rows,
  () => {
    if (!editingRowId.value) return
    const stillExists = props.rows.some((row) => rowId(row) === editingRowId.value)
    if (!stillExists) cancelEdit()
  },
)
</script>

<template>
  <p v-if="props.rows.length === 0">No rows found.</p>

  <div v-else class="table-wrapper">
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
          @click="isRowEditable(row) && startEdit(row)"
        >
          <td v-for="column in columns" :key="column">
            {{ formatCell(row[column]) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <section v-if="isEditable && editingRowId" class="edit-form">
    <h3>Edit Row</h3>

    <form class="edit-grid" @submit.prevent="updateRow">
      <label v-for="field in fields" :key="field.name" class="field">
        <span class="field-label">{{ field.name }}</span>

        <input
          v-if="field.type === 'text'"
          :value="String(editValues[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @input="setEditValue(field, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="field.type === 'number'"
          type="number"
          :value="String(editValues[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @input="setEditValue(field, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="field.type === 'hex'"
          :value="String(editValues[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @input="setEditValue(field, ($event.target as HTMLInputElement).value)"
        />

        <select
          v-else-if="field.type === 'select'"
          :value="String(editValues[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @change="setEditValue(field, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in getFieldOptions(field)" :key="option.value || '__null__'" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <input
          v-else
          type="checkbox"
          :checked="Boolean(editValues[field.name])"
          :data-testid="`edit-${field.name}`"
          @change="setEditValue(field, ($event.target as HTMLInputElement).checked)"
        />
      </label>

      <div class="edit-actions">
        <button type="submit" class="save-btn">Save</button>
        <button type="button" class="cancel-btn" @click="cancelEdit">Cancel</button>
      </div>
    </form>
  </section>

  <p v-if="updateError" class="edit-error">{{ updateError }}</p>
  <p v-else-if="updateSuccess" class="edit-success">{{ updateSuccess }}</p>
</template>

<style scoped>
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

.editable-row {
  cursor: pointer;
}

.editable-row:hover {
  background: #f8fafc;
}

.edit-form {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 8px;
  margin-top: 10px;
}

h3 {
  margin: 0 0 8px;
  font-size: 13px;
}

.edit-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.field-label {
  color: #374151;
}

input,
select {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
}

.edit-actions {
  display: flex;
  gap: 6px;
}

.save-btn,
.cancel-btn {
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
}

.save-btn {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
}

.cancel-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
}

.edit-error {
  color: #b91c1c;
  margin: 8px 0 0;
  font-size: 12px;
}

.edit-success {
  color: #047857;
  margin: 8px 0 0;
  font-size: 12px;
}
</style>
