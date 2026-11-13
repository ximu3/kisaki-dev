/** @fileoverview Identifies the supported database, applies Drizzle's migration chain and initializes only missing singleton data. */

import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type Database from 'better-sqlite3'
import { parsePreferences } from '@kisaki3/desktop-contracts/preferences'
import type { Preferences } from '@kisaki3/desktop-contracts/preferences'
import { configureConnection, openConnection } from './connection'
import { createPreferencesTable } from './schema/preferences'
import { preparePreferences } from './codecs/preferences'
import * as tables from './schema'
import { relations } from './relations'

/** Database-file identity established by the first formal migration, independent of application version. */
const applicationId = 0x4b534b33

/** Explicit deployment paths and complete product defaults used by database initialization. */
export interface DatabaseOptions {
  readonly path: string
  readonly nativeBinding: string
  readonly migrationsDirectory: string
  readonly defaults: Preferences
}

/** An unsupported or structurally incomplete database, retaining the original cause for diagnostics. */
export class DatabaseFormatError extends Error {
  /** Describes why the file cannot be opened by this migration chain without changing it. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DatabaseFormatError'
  }
}

/** Checks storage identity and migration compatibility before any schema or journal mutation. */
function inspectFormat(connection: Database.Database, migrationsDirectory: string): void {
  const objects = connection
    .prepare("select name from sqlite_schema where type = 'table' and name not like 'sqlite_%'")
    .pluck()
    .all() as string[]
  const identity = connection.pragma('application_id', { simple: true })
  if (objects.length === 0 && identity === 0) {
    return
  }
  // Drizzle creates its empty ledger before the first migration transaction starts.
  if (
    identity === 0 &&
    objects.length === 1 &&
    objects[0] === '__drizzle_migrations' &&
    connection.prepare('select count(*) from __drizzle_migrations').pluck().get() === 0
  ) {
    return
  }
  if (identity !== applicationId || !objects.includes('__drizzle_migrations')) {
    throw new DatabaseFormatError('The file is not a supported Kisaki database')
  }

  const supported = new Map(
    readMigrationFiles({ migrationsFolder: migrationsDirectory }).map((migration) => [
      migration.name,
      migration.hash,
    ]),
  )
  const applied = connection.prepare('select name, hash from __drizzle_migrations').all() as {
    name: string
    hash: string
  }[]
  if (
    applied.length === 0 ||
    applied.some((migration) => supported.get(migration.name) !== migration.hash)
  ) {
    throw new DatabaseFormatError(
      'The database migration history is not supported by this application',
    )
  }
}

/** Checks required current columns and their actual nullability after migrations complete. */
function inspectStructure(connection: Database.Database, schema: readonly SQLiteTable[]): void {
  for (const table of schema) {
    const definition = getTableConfig(table)
    const columns = connection.pragma(
      `table_xinfo('${definition.name.replaceAll("'", "''")}')`,
    ) as { name: string; notnull: number; pk: number; type: string }[]
    const actual = new Map(columns.map((column) => [column.name, column]))
    for (const column of definition.columns) {
      const saved = actual.get(column.name)
      if (
        !saved ||
        (column.notNull &&
          saved.notnull !== 1 &&
          !(saved.pk === 1 && saved.type.toLowerCase() === 'integer'))
      ) {
        throw new DatabaseFormatError(
          'The database is missing a required storage column or constraint',
        )
      }
    }
  }
}

/**
 * Opens the already selected local data path and completes initialization before returning.
 *
 * The path owner verifies local filesystem support before this synchronous call. The returned
 * Drizzle connection uses synchronous queries and transactions; I/O and preparation stay outside
 * transaction callbacks. A failed initialization closes the connection and preserves the file.
 */
export function initializeDatabase(options: DatabaseOptions) {
  const defaults = parsePreferences(options.defaults)
  const connection = openConnection(options.path, options.nativeBinding)
  try {
    inspectFormat(connection, options.migrationsDirectory)
    configureConnection(connection)
    const db = drizzle({ client: connection, relations })
    migrate(db, { migrationsFolder: options.migrationsDirectory })

    const preferences = createPreferencesTable(defaults)
    inspectStructure(connection, [...Object.values(tables), preferences])
    if (!db.select({ id: preferences.id }).from(preferences).get()) {
      db.insert(preferences)
        .values({ id: 1, ...preparePreferences(defaults) })
        .run()
    }

    return {
      db,
      preferences,
      /** Closes this connection after its consumers have finished; repeated close is harmless. */
      close() {
        if (connection.open) {
          connection.close()
        }
      },
    }
  } catch (error) {
    try {
      connection.close()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Database initialization and cleanup failed',
        { cause: cleanupError },
      )
    }
    throw error
  }
}

/** The initialized connection and singleton mappings owned by one application instance. */
export type Storage = ReturnType<typeof initializeDatabase>

/** The synchronous Drizzle transaction accepted by storage consumers. */
export type StorageTransaction = Parameters<Parameters<Storage['db']['transaction']>[0]>[0]
