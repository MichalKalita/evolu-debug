import {
  NonEmptyString,
  SimpleName,
  Uint8Array as Uint8ArrayType,
  createEvolu,
  id,
  nullOr,
  type EvoluSchema,
  union,
} from '@evolu/common'
import { EvoluContext } from '@evolu/vue'
import { evoluWebDeps } from '@evolu/web'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { EvoluDebugSchemaContext } from '../context'
import TableDetail from './TableDetail.vue'

const DebugRowId = id('DebugRow')

const schema = {
  debugRow: {
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
})
