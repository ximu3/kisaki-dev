/** @fileoverview Provides SQLite constraints shared by formal tables, without adding business operations. */

import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { check, integer, text } from 'drizzle-orm/sqlite-core'

/** Creates the required UTC millisecond fields supplied by the record's owning operation. */
export function timestamps() {
  return {
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  }
}

/** Creates a required identity column; its table declares the primary-key constraint. */
export function idColumn(name = 'id') {
  return text(name).notNull()
}

/** Restricts a nullable or required integer to a safe range; NULL follows the column's own rule. */
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

/** Restricts a nullable or required boolean to SQLite's two integer values. */
export function booleanValue(name: string, column: AnySQLiteColumn) {
  return check(name, sql`${column} in (0, 1)`)
}

/** Restricts a textual classification to its fixed storage vocabulary. */
export function enumValue(name: string, column: AnySQLiteColumn, values: readonly string[]) {
  const literals = values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ')
  return check(name, sql`${column} in (${sql.raw(literals)})`)
}

/** Requires a nonempty stored identifier without reinterpreting its spelling. */
export function nonempty(name: string, column: AnySQLiteColumn) {
  return check(name, sql`length(${column}) > 0`)
}
