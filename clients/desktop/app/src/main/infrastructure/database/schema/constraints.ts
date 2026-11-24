import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

export function timestamps() {
  return {
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  }
}

export function idColumn(name = 'id') {
  return text(name).notNull()
}

export function safeInteger(
  name: string,
  column: AnySQLiteColumn,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  return check(
    name,
    sql`${column} is null or (typeof(${column}) = 'integer' and ${column} between ${sql.raw(String(min))} and ${sql.raw(String(max))})`,
  )
}

export function booleanValue(name: string, column: AnySQLiteColumn) {
  return check(name, sql`${column} in (0, 1)`)
}

export function enumValue(name: string, column: AnySQLiteColumn, values: readonly string[]) {
  const literals = values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ')
  return check(name, sql`${column} in (${sql.raw(literals)})`)
}

export function nonempty(name: string, column: AnySQLiteColumn) {
  return check(name, sql`length(${column}) > 0`)
}

export function workForeignKey(
  id: AnySQLiteColumn,
  work: AnySQLiteColumn,
  parentId: AnySQLiteColumn,
  parentWork: AnySQLiteColumn,
) {
  return foreignKey({ columns: [id, work], foreignColumns: [parentId, parentWork] })
}

export function retainedWorkReference(
  id: AnySQLiteColumn,
  work: AnySQLiteColumn,
  parentId: AnySQLiteColumn,
  parentWork: AnySQLiteColumn,
) {
  return [
    foreignKey({ columns: [id], foreignColumns: [parentId] }).onDelete('set null'),
    workForeignKey(id, work, parentId, parentWork),
  ]
}
