import { createEvolu, id, NonEmptyString, SimpleName, type EvoluSchema } from '@evolu/common'
import { EvoluContext } from '@evolu/vue'
import { evoluWebDeps } from '@evolu/web'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import Tables from './Tables.vue'
import { EvoluDebugSchemaContext } from '../context'

const TodoId = id('Todo')

const schema = {
  todo: {
    id: TodoId,
    title: NonEmptyString,
  },
} satisfies EvoluSchema

const waitFor = async (
  condition: () => boolean,
  timeoutMs = 10000,
  intervalMs = 50,
): Promise<void> => {
  const start = Date.now()

  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition')
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

const createTestEvolu = (suffix: string) =>
  createEvolu(evoluWebDeps)(schema, {
    name: SimpleName.orThrow(`evdb${suffix}`),
  })

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

describe('Tables (browser, real Evolu)', () => {
  it('loads tables from real Evolu and emits selection', async () => {
    const evolu = createTestEvolu(String(Date.now()).slice(-8))
    const wrapper = mount(Tables, {
      props: { selectedTable: null },
      global: {
        provide: {
          [EvoluContext as symbol]: evolu,
          [EvoluDebugSchemaContext as symbol]: schema,
        },
      },
    })

    cleanup = () => wrapper.unmount()

    await waitFor(() => {
      const emitted = wrapper.emitted('tables-loaded') ?? []
      return emitted.some((eventArgs) => {
        const payload = eventArgs?.[0]
        return Array.isArray(payload) && payload.includes('todo')
      })
    })

    const tableButtons = wrapper.findAll('button.table-link')
    expect(tableButtons.some((button) => button.text() === 'todo')).toBe(true)

    const orderedNames = tableButtons.map((button) => button.text())
    const firstEvoluIndex = orderedNames.findIndex((name) => name.startsWith('evolu_'))
    const regularPart =
      firstEvoluIndex === -1 ? orderedNames : orderedNames.slice(0, firstEvoluIndex)
    const evoluPart = firstEvoluIndex === -1 ? [] : orderedNames.slice(firstEvoluIndex)
    const sortedRegular = [...regularPart].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    )

    expect(regularPart.every((name) => !name.startsWith('evolu_'))).toBe(true)
    expect(evoluPart.every((name) => name.startsWith('evolu_'))).toBe(true)
    expect(regularPart).toEqual(sortedRegular)

    const todoButton = tableButtons.find((button) => button.text() === 'todo')
    expect(todoButton).toBeDefined()
    await todoButton!.trigger('click')

    const selectionEvents = wrapper.emitted('select-table') ?? []
    expect(selectionEvents.some((eventArgs) => eventArgs?.[0] === 'todo')).toBe(true)
  })
})
