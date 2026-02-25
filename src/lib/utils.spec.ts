import { describe, expect, it } from 'vitest'
import { String, brand, optional, union } from '@evolu/common'
import {
  buildInsertFields,
  filterRowsBySearch,
  formatCell,
  formatSchemaType,
  getRuntimeValueType,
  inferColumnDataType,
  isBinaryObject,
  parseInsertFieldValue,
  sortTables,
  splitTables,
  type RowData,
} from './utils'

describe('sortTables', () => {
  it('sorts tables alphabetically case-insensitive', () => {
    const result = sortTables(['zeta', 'Alpha', 'beta'])

    expect(result).toEqual(['Alpha', 'beta', 'zeta'])
  })
})

describe('splitTables', () => {
  it('splits regular and evolu internal tables', () => {
    const result = splitTables(['todo', 'evolu_history', 'chatMessage'])

    expect(result.regularTables).toEqual(['todo', 'chatMessage'])
    expect(result.evoluInternalTables).toEqual(['evolu_history'])
  })
})

describe('isBinaryObject', () => {
  it('detects index-keyed byte object', () => {
    expect(isBinaryObject({ 0: 164, 1: 222, 2: 157 })).toBe(true)
  })

  it('rejects non-binary objects', () => {
    expect(isBinaryObject({ a: 1 })).toBe(false)
    expect(isBinaryObject({ 0: 256 })).toBe(false)
    expect(isBinaryObject(null)).toBe(false)
  })
})

describe('formatCell', () => {
  it('formats primitive and object values', () => {
    expect(formatCell(null)).toBe('null')
    expect(formatCell(undefined)).toBe('')
    expect(formatCell(42)).toBe('42')
    expect(formatCell({ a: 1 })).toBe('{"a":1}')
  })

  it('formats Uint8Array as uppercase hex preview with size', () => {
    const bytes = new Uint8Array([164, 222, 157, 79, 249, 170, 197, 155, 84, 108, 138])

    expect(formatCell(bytes)).toBe('0xA4DE9D4FF9AAC59B546C (11 B)')
  })

  it('formats ArrayBuffer and binary objects as uppercase hex preview with size', () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer
    const binaryObject = { 0: 1, 2: 3, 1: 2, 3: 4 }

    expect(formatCell(buffer)).toBe('0x01020304 (4 B)')
    expect(formatCell(binaryObject)).toBe('0x01020304 (4 B)')
  })
})

describe('getRuntimeValueType', () => {
  it('returns byte type for byte-like values', () => {
    expect(getRuntimeValueType(new Uint8Array([1]))).toBe('bytes')
    expect(getRuntimeValueType({ 0: 1, 1: 2 })).toBe('bytes')
  })

  it('returns expected primitive and object types', () => {
    expect(getRuntimeValueType('hello')).toBe('string')
    expect(getRuntimeValueType(123)).toBe('number')
    expect(getRuntimeValueType(null)).toBe('null')
    expect(getRuntimeValueType({ hello: 'world' })).toBe('object')
  })
})

describe('inferColumnDataType', () => {
  it('infers no data, single type, and mixed types', () => {
    const rows: RowData[] = [
      { title: 'a', payload: { 0: 1, 1: 2 } },
      { title: 'b', payload: null },
    ]

    expect(inferColumnDataType(rows, 'missing')).toBe('no data')
    expect(inferColumnDataType(rows, 'title')).toBe('string')
    expect(inferColumnDataType(rows, 'payload')).toBe('mixed(bytes|null)')
  })
})

describe('filterRowsBySearch', () => {
  it('filters rows using visible columns and case-insensitive matching', () => {
    const rows: RowData[] = [
      { id: '1', title: 'Buy milk', priority: 'high' },
      { id: '2', title: 'Read docs', priority: 'low' },
    ]

    expect(filterRowsBySearch(rows, '', ['title', 'priority']).length).toBe(2)
    expect(filterRowsBySearch(rows, 'milk', ['title']).map((row) => row.id)).toEqual(['1'])
    expect(filterRowsBySearch(rows, 'LOW', ['priority']).map((row) => row.id)).toEqual(['2'])
    expect(filterRowsBySearch(rows, 'missing', ['title']).length).toBe(0)
  })
})

describe('formatSchemaType', () => {
  it('formats union literals with concrete members', () => {
    const Priority = union('low', 'high')

    expect(formatSchemaType(Priority)).toBe('"low" | "high"')
  })

  it('formats brand and optional types', () => {
    const BrandedString = brand('ExampleId', String)
    const OptionalString = optional(String)

    expect(formatSchemaType(BrandedString)).toBe('ExampleId<String>')
    expect(formatSchemaType(OptionalString)).toBe('String (optional)')
  })

  it('handles recursive types safely', () => {
    const RecursiveUnion: { name: string; members: unknown[] } = {
      name: 'Union',
      members: [],
    }
    RecursiveUnion.members = [RecursiveUnion]

    expect(formatSchemaType(RecursiveUnion)).toBe('[Recursive]')
  })
})

describe('insert field helpers', () => {
  it('builds insert field definitions from schema columns', () => {
    const fields = buildInsertFields({
      id: { name: 'Brand', parentType: { name: 'String' } },
      title: { name: 'String' },
      categoryId: {
        name: 'Union',
        members: [
          { name: 'Null' },
          {
            name: 'Brand',
            brand: 'TodoCategoryId',
            parentType: { name: 'String' },
          },
        ],
      },
      projectId: { name: 'Id', table: 'Project' },
      priority: {
        name: 'Union',
        members: [
          { name: 'Literal', expected: 'low' },
          { name: 'Literal', expected: 'high' },
        ],
      },
      done: { name: 'SqliteBoolean' },
      attachment: {
        name: 'Union',
        members: [{ name: 'Null' }, { name: 'Uint8Array' }],
      },
    })

    expect(fields.map((field) => field.name)).toEqual([
      'title',
      'categoryId',
      'projectId',
      'priority',
      'done',
      'attachment',
    ])

    expect(fields.find((field) => field.name === 'categoryId')?.type).toBe('select')
    expect(fields.find((field) => field.name === 'categoryId')?.referenceTable).toBe(
      'todoCategory',
    )
    expect(fields.find((field) => field.name === 'categoryId')?.required).toBe(false)
    expect(fields.find((field) => field.name === 'projectId')?.type).toBe('select')
    expect(fields.find((field) => field.name === 'projectId')?.referenceTable).toBe('project')
    expect(fields.find((field) => field.name === 'priority')?.type).toBe('select')
    expect(fields.find((field) => field.name === 'priority')?.options).toEqual(['low', 'high'])
    expect(fields.find((field) => field.name === 'done')?.type).toBe('checkbox')
    expect(fields.find((field) => field.name === 'attachment')?.type).toBe('hex')
    expect(fields.find((field) => field.name === 'attachment')?.required).toBe(false)
  })

  it('parses insert field values based on field types', () => {
    expect(
      parseInsertFieldValue(
        {
          name: 'count',
          type: 'number',
          required: true,
          options: [],
          referenceTable: null,
        },
        '42',
      ),
    ).toBe(42)

    expect(
      parseInsertFieldValue(
        {
          name: 'isDone',
          type: 'checkbox',
          required: true,
          options: [],
          referenceTable: null,
        },
        true,
      ),
    ).toBe(1)

    expect(
      parseInsertFieldValue(
        {
          name: 'isDone',
          type: 'checkbox',
          required: true,
          options: [],
          referenceTable: null,
        },
        false,
      ),
    ).toBe(0)

    expect(
      parseInsertFieldValue(
        {
          name: 'attachment',
          type: 'hex',
          required: false,
          options: [],
          referenceTable: null,
        },
        'A4DE',
      ),
    ).toEqual(new Uint8Array([164, 222]))

    expect(
      parseInsertFieldValue(
        {
          name: 'title',
          type: 'text',
          required: false,
          options: [],
          referenceTable: null,
        },
        '',
      ),
    ).toBeNull()

    expect(
      parseInsertFieldValue(
        {
          name: 'isCompleted',
          type: 'select',
          required: false,
          options: ['0', '1'],
          referenceTable: null,
        },
        '0',
      ),
    ).toBe(0)
  })
})
