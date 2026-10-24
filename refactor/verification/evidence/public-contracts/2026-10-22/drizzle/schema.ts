import { sql, defineRelations } from 'drizzle-orm'
import { sqliteTable, text, integer, customType, primaryKey, check } from 'drizzle-orm/sqlite-core'

export type ProbeDate = { year: number; month?: number; day?: number }

export function parseProbeDate(value: unknown): ProbeDate | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const date = value as Record<string, unknown>
  if (Object.keys(date).some((key) => !['year', 'month', 'day'].includes(key))) return null
  if (typeof date.year !== 'number' || !Number.isSafeInteger(date.year)) return null
  if (
    date.month !== undefined &&
    (!Number.isInteger(date.month) || Number(date.month) < 1 || Number(date.month) > 12)
  )
    return null
  if (date.day !== undefined) {
    if (date.month === undefined || !Number.isInteger(date.day)) return null
    const leap = date.year % 4 === 0 && (date.year % 100 !== 0 || date.year % 400 === 0)
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if (Number(date.day) < 1 || Number(date.day) > days[Number(date.month) - 1]!) return null
  }
  return {
    year: date.year,
    ...(date.month === undefined ? {} : { month: Number(date.month) }),
    ...(date.day === undefined ? {} : { day: Number(date.day) })
  }
}

const probeDate = customType<{ data: ProbeDate | null; driverData: string; jsonData: unknown }>({
  dataType: () => 'text',
  fromDriver: parseProbeDate,
  fromJson: parseProbeDate,
  toDriver(value) {
    const parsed = parseProbeDate(value)
    if (parsed === null || typeof value !== 'object') throw new Error('Invalid probe date.')
    return JSON.stringify(parsed)
  }
})

export const entries = sqliteTable(
  'entries',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    released: probeDate(),
    favorite: integer({ mode: 'boolean' }).notNull().default(false),
    note: text().notNull().default('')
  },
  (table) => [check('entry_name_nonempty', sql`length(${table.name}) > 0`)]
)

export const identities = sqliteTable(
  'identities',
  {
    source: text().notNull(),
    sourceId: text('source_id').notNull(),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.source, table.sourceId] })]
)

export const relations = defineRelations({ entries, identities }, (r) => ({
  entries: { identities: r.many.identities({ from: r.entries.id, to: r.identities.entryId }) },
  identities: { entry: r.one.entries({ from: r.identities.entryId, to: r.entries.id }) }
}))
