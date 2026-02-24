import {
  NonEmptyString,
  NonEmptyString1000,
  SimpleName,
  SqliteBoolean,
  Uint8Array as Uint8ArrayType,
  createEvolu,
  id,
  maxLength,
  nullOr,
  type EvoluSchema,
  union,
} from '@evolu/common'
import { EvoluContext } from '@evolu/vue'
import { evoluWebDeps } from '@evolu/web'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { EvoluDebugSchemaContext } from '../context'
import TableDetail from './TableDetail.vue'

const DebugRowId = id('DebugRow')
const TodoId = id('Todo')
const TodoCategoryId = id('TodoCategory')
const NonEmptyString50 = maxLength(50)(NonEmptyString)

const schema = {
  debugRow: {
    id: DebugRowId,
    title: NonEmptyString,
    mode: union('low', 'high'),
    blob: nullOr(Uint8ArrayType),
  },
  debugRowAlt: {
    id: DebugRowId,
    title: NonEmptyString,
    mode: union('low', 'high'),
    blob: nullOr(Uint8ArrayType),
  },
} satisfies EvoluSchema

const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 10000,
  intervalMs = 50,
): Promise<void> => {
  const start = Date.now()

  while (!(await condition())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

const createTestEvolu = (suffix: string) =>
  createEvolu(evoluWebDeps)(schema, {
    name: SimpleName.orThrow(`evdt${suffix}`),
  })

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

describe('TableDetail (browser, real Evolu)', () => {
  it('renders data rows and schema details using real Evolu', async () => {
    const evolu = createTestEvolu(String(Date.now()).slice(-8))

    evolu.insert('debugRow', {
      title: 'first',
      mode: 'low',
      blob: new Uint8Array([164, 222, 157, 79, 249, 170, 197, 155, 84, 108, 138]),
    })
    evolu.insert('debugRow', {
      title: 'second',
      mode: 'high',
      blob: null,
    })

    const rowsQuery = evolu.createQuery((db) =>
      db
        .selectFrom('debugRow')
        .select(['id'])
        .where('title', 'is not', null),
    )

    await waitFor(async () => {
      const rows = await evolu.loadQuery(rowsQuery)
      return rows.length >= 2
    })

    const wrapper = mount(TableDetail, {
      props: { tableName: 'debugRow' },
      global: {
        provide: {
          [EvoluContext as symbol]: evolu,
          [EvoluDebugSchemaContext as symbol]: schema,
        },
      },
    })

    cleanup = () => wrapper.unmount()

    await waitFor(() => wrapper.text().includes('first'))

    expect(wrapper.text()).toContain('first')
    expect(wrapper.text()).toContain('second')
    expect(wrapper.text()).toContain('0xA4DE9D4FF9AAC59B546C (11 B)')

    const schemaButton = wrapper
      .findAll('button.switch-btn')
      .find((button) => button.text().trim() === 'Schema')
    expect(schemaButton).toBeDefined()
    await schemaButton!.trigger('click')

    await waitFor(() => wrapper.text().includes('Schema Type'))

    const text = wrapper.text()
    expect(text).toContain('"low" | "high"')
    expect(text).toContain('mixed(')
    expect(text).toContain('bytes')
    expect(text).toContain('null')
    expect(text).toContain('String')
  })

  it('reloads data when table changes', async () => {
    const evolu = createTestEvolu(String(Date.now() + 1).slice(-8))

    evolu.insert('debugRow', {
      title: 'from-first-table',
      mode: 'low',
      blob: null,
    })
    evolu.insert('debugRowAlt', {
      title: 'from-second-table',
      mode: 'high',
      blob: null,
    })

    const Harness = defineComponent({
      setup() {
        const selectedTable = ref<'debugRow' | 'debugRowAlt'>('debugRow')
        const switchTable = () => {
          selectedTable.value = 'debugRowAlt'
        }
        return () =>
          h('div', [
            h(
              'button',
              {
                class: 'switch-table',
                onClick: switchTable,
              },
              'Switch',
            ),
            h(TableDetail, {
              key: selectedTable.value,
              tableName: selectedTable.value,
            }),
          ])
      },
    })

    const wrapper = mount(Harness, {
      global: {
        provide: {
          [EvoluContext as symbol]: evolu,
          [EvoluDebugSchemaContext as symbol]: schema,
        },
      },
    })

    cleanup = () => wrapper.unmount()

    await waitFor(() => wrapper.text().includes('from-first-table'))
    expect(wrapper.text()).toContain('from-first-table')

    await wrapper.get('button.switch-table').trigger('click')

    await waitFor(() => wrapper.text().includes('from-second-table'))
    expect(wrapper.text()).toContain('from-second-table')
  })

  it('inserts a new row through schema-driven form', async () => {
    const evolu = createTestEvolu(String(Date.now() + 2).slice(-8))

    const wrapper = mount(TableDetail, {
      props: { tableName: 'debugRow' },
      global: {
        provide: {
          [EvoluContext as symbol]: evolu,
          [EvoluDebugSchemaContext as symbol]: schema,
        },
      },
    })

    cleanup = () => wrapper.unmount()

    await waitFor(() => wrapper.text().includes('Add Row'))

    await wrapper.get('[data-testid="insert-title"]').setValue('inserted-row')
    await wrapper.get('[data-testid="insert-mode"]').setValue('high')
    await wrapper.get('[data-testid="insert-blob"]').setValue('A4DE')
    await wrapper.get('form.insert-grid').trigger('submit')

    await waitFor(() => wrapper.text().includes('Row inserted.'))
    await waitFor(() => wrapper.text().includes('inserted-row'))

    expect(wrapper.text()).toContain('inserted-row')
    expect(wrapper.text()).toContain('0xA4DE (2 B)')
  })

  it('supports todo + todoCategory insert flow with reference select and null option', async () => {
    const todoSchema = {
      todo: {
        id: TodoId,
        title: NonEmptyString1000,
        isCompleted: nullOr(SqliteBoolean),
        categoryId: nullOr(TodoCategoryId),
        priority: union('low', 'high'),
      },
      todoCategory: {
        id: TodoCategoryId,
        name: NonEmptyString50,
      },
    } satisfies EvoluSchema

    const evolu = createEvolu(evoluWebDeps)(todoSchema, {
      name: SimpleName.orThrow(`evtodo${String(Date.now() + 3).slice(-8)}`),
    })

    const categoryWrapper = mount(TableDetail, {
      props: { tableName: 'todoCategory' },
      global: {
        provide: {
          [EvoluContext as symbol]: evolu,
          [EvoluDebugSchemaContext as symbol]: todoSchema,
        },
      },
    })

    cleanup = () => categoryWrapper.unmount()

    await waitFor(() => categoryWrapper.text().includes('Add Row'))
    await categoryWrapper.get('[data-testid="insert-name"]').setValue('Work')
    await categoryWrapper.get('form.insert-grid').trigger('submit')
    await waitFor(() => categoryWrapper.text().includes('Work'))

    categoryWrapper.unmount()

    const todoWrapper = mount(TableDetail, {
      props: { tableName: 'todo' },
      global: {
        provide: {
          [EvoluContext as symbol]: evolu,
          [EvoluDebugSchemaContext as symbol]: todoSchema,
        },
      },
    })

    cleanup = () => todoWrapper.unmount()

    await waitFor(() => todoWrapper.text().includes('Add Row'))

    const categorySelect = todoWrapper.get('[data-testid="insert-categoryId"]')
    await waitFor(() => categorySelect.findAll('option').length >= 2)

    const optionLabels = categorySelect.findAll('option').map((option) => option.text())
    expect(optionLabels).toContain('null')
    expect(optionLabels).toContain('Work')

    await todoWrapper.get('[data-testid="insert-title"]').setValue('Buy milk')
    await todoWrapper.get('[data-testid="insert-priority"]').setValue('high')
    await categorySelect.setValue('')
    await todoWrapper.get('form.insert-grid').trigger('submit')

    await waitFor(() => todoWrapper.text().includes('Buy milk'))
    expect(todoWrapper.text()).toContain('Buy milk')

    const categoryValue = categorySelect
      .findAll('option')
      .find((option) => option.text() === 'Work')
      ?.element.getAttribute('value')
    expect(categoryValue).toBeTruthy()

    await todoWrapper.get('[data-testid="insert-title"]').setValue('Read docs')
    await todoWrapper.get('[data-testid="insert-priority"]').setValue('low')
    await categorySelect.setValue(categoryValue as string)
    await todoWrapper.get('form.insert-grid').trigger('submit')

    await waitFor(() => todoWrapper.text().includes('Read docs'))
    expect(todoWrapper.text()).toContain('Read docs')
  })
})
