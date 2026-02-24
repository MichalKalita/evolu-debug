import { describe, expect, it } from 'vitest'
import { String, brand, optional, union } from '@evolu/common'
import {
  formatCell,
  formatSchemaType,
  getRuntimeValueType,
  inferColumnDataType,
  isBinaryObject,
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
