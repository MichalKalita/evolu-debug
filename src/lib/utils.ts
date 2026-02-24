export type RowData = Record<string, unknown>

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
