<script setup lang="ts">
import { useEvolu, useQuery } from '@evolu/vue'
import { computed, ref, watch } from 'vue'
import {
  buildInsertFields,
  isBinaryObject,
  parseInsertFieldValue,
  type InsertFieldConfig,
  type RowData,
  type SchemaColumns,
} from '../lib/utils'

const props = defineProps<{
  tableName: string
  schemaColumns: SchemaColumns
  row: RowData | null
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const evolu = useEvolu()

type ReferenceOption = { value: string; label: string }

const fields = computed(() => buildInsertFields(props.schemaColumns))
const values = ref<Record<string, string | boolean>>({})
const updateError = ref<string | null>(null)
const updateSuccess = ref<string | null>(null)

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

watch(
  () => props.row,
  (row) => {
    updateError.value = null
    updateSuccess.value = null
    if (!row) {
      values.value = {}
      return
    }

    const nextValues: Record<string, string | boolean> = {}

    for (const field of fields.value) {
      const value = row[field.name]

      if (field.type === 'checkbox') {
        nextValues[field.name] = value === 1 || value === true
      } else if (field.type === 'hex') {
        nextValues[field.name] = normalizeHexValue(value)
      } else if (field.type === 'select') {
        nextValues[field.name] = value == null ? '' : String(value)
      } else {
        nextValues[field.name] = value == null ? '' : String(value)
      }
    }

    values.value = nextValues
  },
  { immediate: true },
)

const setValue = (field: InsertFieldConfig, value: string | boolean) => {
  values.value[field.name] = value
}

const extractErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

const save = async () => {
  updateError.value = null
  updateSuccess.value = null

  const row = props.row
  if (!row || typeof row.id !== 'string') return

  try {
    const payload: Record<string, unknown> = { id: row.id }

    for (const field of fields.value) {
      const rawValue = values.value[field.name] ?? ''
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
    emit('close')
  } catch (error: unknown) {
    updateError.value = extractErrorMessage(error)
  }
}
</script>

<template>
  <section v-if="props.row" class="edit-form">
    <div class="edit-header">
      <h3>Edit Row</h3>
      <button type="button" class="close-btn" @click="emit('close')">Close</button>
    </div>

    <form class="edit-grid" @submit.prevent="save">
      <label v-for="field in fields" :key="field.name" class="field">
        <span class="field-label">{{ field.name }}</span>

        <input
          v-if="field.type === 'text'"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @input="setValue(field, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="field.type === 'number'"
          type="number"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @input="setValue(field, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="field.type === 'hex'"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @input="setValue(field, ($event.target as HTMLInputElement).value)"
        />

        <select
          v-else-if="field.type === 'select'"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`edit-${field.name}`"
          @change="setValue(field, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in getFieldOptions(field)" :key="option.value || '__null__'" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <input
          v-else
          type="checkbox"
          :checked="Boolean(values[field.name])"
          :data-testid="`edit-${field.name}`"
          @change="setValue(field, ($event.target as HTMLInputElement).checked)"
        />
      </label>

      <button type="submit" class="save-btn">Save</button>
    </form>

    <p v-if="updateError" class="edit-error">{{ updateError }}</p>
    <p v-else-if="updateSuccess" class="edit-success">{{ updateSuccess }}</p>
  </section>
</template>

<style scoped>
.edit-form {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 8px;
  background: #fff;
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

h3 {
  margin: 0;
  font-size: 13px;
}

.close-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
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

.save-btn {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  align-self: flex-start;
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
