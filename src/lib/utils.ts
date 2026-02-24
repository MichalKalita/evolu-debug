export type RowData = Record<string, unknown>
export type SchemaColumns = Readonly<Record<string, unknown>>

export type InsertFieldType = 'text' | 'number' | 'checkbox' | 'hex' | 'select'

export type InsertFieldConfig = {
  name: string
  type: InsertFieldType
  required: boolean
  options: string[]
  referenceTable: string | null
}

const formatLiteral = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

const formatHexPreview = (bytes: ReadonlyArray<number>): string =>
  bytes
    .slice(0, 10)
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join('')

export const sortTables = (tables: ReadonlyArray<string>): string[] =>
  [...tables].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

export const splitTables = (tables: ReadonlyArray<string>) => ({
  regularTables: tables.filter((table) => !table.startsWith('evolu_')),
  evoluInternalTables: tables.filter((table) => table.startsWith('evolu_')),
})

export const isBinaryObject = (value: unknown): value is Record<string, number> => {
  if (!value || typeof value !== 'object') return false

  const entries = Object.entries(value)
  if (entries.length === 0) return false

  return entries.every(([key, entryValue]) => {
    const index = Number(key)

    return (
      Number.isInteger(index) &&
      index >= 0 &&
      typeof entryValue === 'number' &&
      Number.isInteger(entryValue) &&
      entryValue >= 0 &&
      entryValue <= 255
    )
  })
}

export const formatCell = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return ''

  if (value instanceof Uint8Array) {
    return `0x${formatHexPreview(Array.from(value))} (${value.byteLength} B)`
  }

  if (value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value)
    return `0x${formatHexPreview(Array.from(bytes))} (${bytes.byteLength} B)`
  }

  if (isBinaryObject(value)) {
    const bytes = Object.entries(value)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, byte]) => byte)

    return `0x${formatHexPreview(bytes)} (${bytes.length} B)`
  }

  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const getRuntimeValueType = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return 'bytes'
  if (isBinaryObject(value)) return 'bytes'
  if (typeof value === 'object') return 'object'
  return typeof value
}

export const inferColumnDataType = (
  rows: ReadonlyArray<RowData>,
  columnName: string,
): string => {
  const detectedTypes = new Set<string>()

  for (const row of rows) {
    if (!(columnName in row)) continue
    detectedTypes.add(getRuntimeValueType(row[columnName]))
  }

  if (detectedTypes.size === 0) return 'no data'
  if (detectedTypes.size === 1) return Array.from(detectedTypes)[0] ?? 'no data'
  return `mixed(${Array.from(detectedTypes).join('|')})`
}

export const formatSchemaType = (
  definition: unknown,
  seen: WeakSet<object> = new WeakSet(),
): string => {
  if (!definition || typeof definition !== 'object') {
    if (typeof definition === 'function') return definition.name || 'Function'
    return 'Unknown'
  }

  if (seen.has(definition)) return '[Recursive]'
  seen.add(definition)

  const typeName = 'name' in definition ? (definition as { name?: unknown }).name : null

  if (typeName === 'Union' && 'members' in definition) {
    const members = (definition as { members?: unknown }).members
    if (Array.isArray(members)) {
      return members.map((member) => formatSchemaType(member, seen)).join(' | ')
    }
  }

  if (typeName === 'Literal' && 'expected' in definition) {
    return formatLiteral((definition as { expected: unknown }).expected)
  }

  if (typeName === 'Brand') {
    const brandName = (definition as { brand?: unknown }).brand
    const parentType = (definition as { parentType?: unknown }).parentType
    if (typeof brandName === 'string') {
      return parentType
        ? `${brandName}<${formatSchemaType(parentType, seen)}>`
        : brandName
    }
  }

  if (typeName === 'Optional' && 'parent' in definition) {
    return `${formatSchemaType((definition as { parent: unknown }).parent, seen)} (optional)`
  }

  if (typeof typeName === 'string' && typeName.length > 0) return typeName

  const constructorName = (definition as { constructor?: { name?: string } }).constructor?.name
  if (constructorName && constructorName !== 'Object') return constructorName

  const ownKeys = Object.getOwnPropertyNames(definition)
  if (ownKeys.length > 0) return `Object(${ownKeys.slice(0, 6).join(', ')})`

  return 'Unknown'
}

type ResolvedSchemaType = {
  baseName: string
  nullable: boolean
  optional: boolean
  literalOptions: string[]
  brandName: string | null
  referenceTable: string | null
}

const brandNameToTableName = (brandName: string): string | null => {
  if (!brandName.endsWith('Id') || brandName.length <= 2) return null

  const base = brandName.slice(0, -2)
  if (base.length === 0) return null

  return `${base[0]?.toLowerCase() ?? ''}${base.slice(1)}`
}

const resolveSchemaType = (definition: unknown): ResolvedSchemaType => {
  if (!definition || typeof definition !== 'object') {
    return {
      baseName: 'Unknown',
      nullable: false,
      optional: false,
      literalOptions: [],
      brandName: null,
      referenceTable: null,
    }
  }

  const typeName = 'name' in definition ? (definition as { name?: unknown }).name : null

  if (typeName === 'Optional' && 'parent' in definition) {
    const parentResolved = resolveSchemaType((definition as { parent: unknown }).parent)
    return { ...parentResolved, optional: true }
  }

  if (typeName === 'Brand' && 'parentType' in definition) {
    const parentResolved = resolveSchemaType((definition as { parentType: unknown }).parentType)
    const brandName = (definition as { brand?: unknown }).brand
    return {
      ...parentResolved,
      brandName: typeof brandName === 'string' ? brandName : null,
    }
  }

  if (typeName === 'Id' && 'table' in definition) {
    const table = (definition as { table?: unknown }).table
    const tableName =
      typeof table === 'string' && table.length > 0
        ? `${table[0]?.toLowerCase() ?? ''}${table.slice(1)}`
        : null

    return {
      baseName: 'Id',
      nullable: false,
      optional: false,
      literalOptions: [],
      brandName: null,
      referenceTable: tableName,
    }
  }

  if (typeName === 'Literal' && 'expected' in definition) {
    const literal = (definition as { expected: unknown }).expected
    return {
        baseName: typeof literal === 'string' ? 'String' : typeof literal,
        nullable: literal === null,
        optional: false,
        literalOptions: literal === null ? [] : [String(literal)],
        brandName: null,
        referenceTable: null,
      }
  }

  if (typeName === 'Union' && 'members' in definition) {
    const members = (definition as { members?: unknown }).members
    if (!Array.isArray(members)) {
      return {
        baseName: 'Union',
        nullable: false,
        optional: false,
        literalOptions: [],
        brandName: null,
        referenceTable: null,
      }
    }

    let nullable = false
    let optional = false
    const literalOptions: string[] = []
    const nonNullMemberBaseNames: string[] = []
    const brandNames: string[] = []
    const referenceTables: string[] = []

    for (const member of members) {
      const resolved = resolveSchemaType(member)

      if (resolved.nullable || resolved.baseName === 'Null') {
        nullable = true
      } else {
        nonNullMemberBaseNames.push(resolved.baseName)
      }

      if (resolved.optional) optional = true
      if (resolved.literalOptions.length > 0) literalOptions.push(...resolved.literalOptions)
      if (resolved.brandName) brandNames.push(resolved.brandName)
      if (resolved.referenceTable) referenceTables.push(resolved.referenceTable)
    }

    const uniqueBaseNames = Array.from(new Set(nonNullMemberBaseNames))
    const baseName = uniqueBaseNames.length === 1 ? uniqueBaseNames[0] ?? 'Union' : 'Union'

    return {
      baseName,
      nullable,
      optional,
      literalOptions: Array.from(new Set(literalOptions)),
      brandName: Array.from(new Set(brandNames))[0] ?? null,
      referenceTable: Array.from(new Set(referenceTables))[0] ?? null,
    }
  }

  if (typeof typeName === 'string' && typeName.length > 0) {
    return {
      baseName: typeName,
      nullable: typeName === 'Null',
      optional: false,
      literalOptions: [],
      brandName: null,
      referenceTable: null,
    }
  }

  return {
    baseName: 'Unknown',
    nullable: false,
    optional: false,
    literalOptions: [],
    brandName: null,
    referenceTable: null,
  }
}

const inferInsertFieldType = (
  baseName: string,
  literalOptions: string[],
  referenceTable: string | null,
): InsertFieldType => {
  if (literalOptions.length > 0) return 'select'
  if (referenceTable) return 'select'
  if (baseName === 'Boolean' || baseName === 'SqliteBoolean') return 'checkbox'
  if (baseName.includes('Number')) return 'number'
  if (baseName === 'Uint8Array' || baseName === 'IdBytes') return 'hex'
  return 'text'
}

export const buildInsertFields = (schemaColumns: SchemaColumns): InsertFieldConfig[] =>
  Object.entries(schemaColumns)
    .filter(([name]) => name !== 'id')
    .map(([name, definition]) => {
      const resolved = resolveSchemaType(definition)
      const referenceTable =
        resolved.referenceTable ??
        (resolved.brandName ? brandNameToTableName(resolved.brandName) : null)
      const type = inferInsertFieldType(
        resolved.baseName,
        resolved.literalOptions,
        referenceTable,
      )

      return {
        name,
        type,
        required: !resolved.nullable && !resolved.optional,
        options: resolved.literalOptions,
        referenceTable,
      }
    })

const parseHexBytes = (value: string): Uint8Array => {
  const normalized = value.trim().replace(/^0x/i, '').replace(/\s+/g, '')

  if (normalized.length === 0) return new Uint8Array([])
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex value must have even number of characters')
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < normalized.length; i += 2) {
    const byte = Number.parseInt(normalized.slice(i, i + 2), 16)
    if (Number.isNaN(byte)) throw new Error('Hex value contains invalid characters')
    bytes[i / 2] = byte
  }

  return bytes
}

export const parseInsertFieldValue = (
  field: InsertFieldConfig,
  value: string | boolean,
): unknown => {
  if (field.type === 'checkbox') return value === true ? 1 : 0

  const raw = String(value).trim()

  if (raw.length === 0) {
    if (field.required) throw new Error(`Field "${field.name}" is required`)
    return null
  }

  if (field.type === 'number') {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) throw new Error(`Field "${field.name}" must be a number`)
    return parsed
  }

  if (field.type === 'hex') {
    return parseHexBytes(raw)
  }

  if (field.type === 'select' && !field.referenceTable) {
    const allNumericOptions =
      field.options.length > 0 && field.options.every((option) => /^-?\d+(\.\d+)?$/.test(option))

    if (allNumericOptions && /^-?\d+(\.\d+)?$/.test(raw)) {
      return Number(raw)
    }
  }

  return raw
}
