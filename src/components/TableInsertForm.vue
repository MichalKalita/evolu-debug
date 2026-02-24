<script setup lang="ts">
import { useEvolu, useQuery } from '@evolu/vue'
import { computed, ref, watch } from 'vue'
import {
  buildInsertFields,
  parseInsertFieldValue,
  type InsertFieldConfig,
  type SchemaColumns,
} from '../lib/utils'

const props = defineProps<{
  tableName: string
  schemaColumns: SchemaColumns
}>()

const evolu = useEvolu()

type ReferenceOption = { value: string; label: string }

const fields = computed(() => buildInsertFields(props.schemaColumns))
const values = ref<Record<string, string | boolean>>({})
const submitError = ref<string | null>(null)
const submitSuccess = ref<string | null>(null)

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

watch(
  fields,
  (newFields) => {
    const nextValues: Record<string, string | boolean> = {}

    for (const field of newFields) {
      if (field.type === 'checkbox') {
        nextValues[field.name] = false
      } else if (field.type === 'select') {
        nextValues[field.name] = getFieldOptions(field)[0]?.value ?? ''
      } else {
        nextValues[field.name] = ''
      }
    }

    values.value = nextValues
    submitError.value = null
    submitSuccess.value = null
  },
  { immediate: true },
)

const setValue = (field: InsertFieldConfig, value: string | boolean) => {
  values.value[field.name] = value
}

const extractInsertErrorMessage = (error: unknown): string => {
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

const insertRow = async () => {
  submitError.value = null
  submitSuccess.value = null

  try {
    const payload: Record<string, unknown> = {}

    for (const field of fields.value) {
      const rawValue = values.value[field.name] ?? ''
      payload[field.name] = parseInsertFieldValue(field, rawValue)
    }

    const insertResult = await Promise.resolve(evolu.insert(props.tableName as never, payload as never))

    if (
      typeof insertResult === 'object' &&
      insertResult !== null &&
      'ok' in insertResult &&
      (insertResult as { ok: boolean }).ok === false
    ) {
      throw (insertResult as { error?: unknown }).error ?? new Error('Insert failed')
    }

    submitSuccess.value = 'Row inserted.'

    for (const field of fields.value) {
      if (field.type === 'checkbox') setValue(field, false)
      else if (field.type === 'select') setValue(field, getFieldOptions(field)[0]?.value ?? '')
      else setValue(field, '')
    }
  } catch (error: unknown) {
    submitError.value = extractInsertErrorMessage(error)
  }
}
</script>

<template>
  <section class="insert-form">
    <h3>Add Row</h3>

    <form class="insert-grid" @submit.prevent="insertRow">
      <label v-for="field in fields" :key="field.name" class="field">
        <span class="field-label">
          {{ field.name }}
          <small v-if="!field.required">optional</small>
        </span>

        <input
          v-if="field.type === 'text'"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`insert-${field.name}`"
          @input="setValue(field, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="field.type === 'number'"
          type="number"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`insert-${field.name}`"
          @input="setValue(field, ($event.target as HTMLInputElement).value)"
        />

        <input
          v-else-if="field.type === 'hex'"
          placeholder="A1B2C3"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`insert-${field.name}`"
          @input="setValue(field, ($event.target as HTMLInputElement).value)"
        />

        <select
          v-else-if="field.type === 'select'"
          :value="String(values[field.name] ?? '')"
          :required="field.required"
          :data-testid="`insert-${field.name}`"
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
          :data-testid="`insert-${field.name}`"
          @change="setValue(field, ($event.target as HTMLInputElement).checked)"
        />
      </label>

      <button type="submit" class="insert-btn">Insert Row</button>
    </form>

    <p v-if="submitError" class="insert-error">{{ submitError }}</p>
    <p v-else-if="submitSuccess" class="insert-success">{{ submitSuccess }}</p>
  </section>
</template>

<style scoped>
.insert-form {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 10px;
  background: #ffffff;
}

h3 {
  margin: 0 0 8px;
  font-size: 13px;
}

.insert-grid {
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

small {
  margin-left: 4px;
  color: #9ca3af;
}

input,
select {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
}

.insert-btn {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #ffffff;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  justify-self: start;
  align-self: flex-start;
}

.insert-error {
  color: #b91c1c;
  margin: 8px 0 0;
  font-size: 12px;
}

.insert-success {
  color: #047857;
  margin: 8px 0 0;
  font-size: 12px;
}
</style>
