/** @fileoverview Identifies the supported database, applies Drizzle's migration chain and initializes only missing singleton data. */

import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { isAbsolute } from 'node:path'
import type Database from 'better-sqlite3'
import type { Preferences } from '@kisaki3/desktop-contracts/preferences'
import { configureConnection, openConnection } from './connection'
import { createPreferencesTable } from './schema/preferences'
import { preparePreferences } from './codecs/preferences'
import { relations } from './relations'
import { openNameOrder } from './name-order'

/** Database-file identity established by the first formal migration, independent of application version. */
const applicationId = 0x4b534b33

/** Explicit deployment paths and complete product defaults used by database initialization. */
export interface DatabaseOptions {
  readonly path: string
  readonly nativeBinding: string
  /** Deployed private SQLite collation extension, also used by the app's Node-API loader. */
  readonly collationExtension: string
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

/** Checks compatibility before mutation and identifies an already migrated library. */
function inspectFormat(connection: Database.Database, migrationsDirectory: string): boolean {
  const objects = connection
    .prepare("select name from sqlite_schema where type = 'table' and name not like 'sqlite_%'")
    .pluck()
    .all() as string[]
  const identity = connection.pragma('application_id', { simple: true })
  if (objects.length === 0 && identity === 0) {
    return false
  }
  // Drizzle creates its empty ledger before the first migration transaction starts.
  if (
    identity === 0 &&
    objects.length === 1 &&
    objects[0] === '__drizzle_migrations' &&
    connection.prepare('select count(*) from __drizzle_migrations').pluck().get() === 0
  ) {
    return false
  }
  if (identity !== applicationId || !objects.includes('__drizzle_migrations')) {
    throw new DatabaseFormatError('The file is not a supported Kisaki database')
  }

  const supported = readMigrationFiles({ migrationsFolder: migrationsDirectory })
  const applied = connection
    .prepare('select name, hash from __drizzle_migrations order by id')
    .all() as {
    name: string
    hash: string
  }[]
  if (
    applied.length === 0 ||
    applied.some(
      (migration, index) =>
        supported[index]?.name !== migration.name || supported[index]?.hash !== migration.hash,
    )
  ) {
    throw new DatabaseFormatError(
      'The database migration history is not supported by this application',
    )
  }
  return true
}

/**
 * Opens the already selected local data path and completes initialization before returning.
 *
 * The path owner verifies local filesystem support before this synchronous call. The returned
 * Drizzle connection uses synchronous queries and transactions; I/O and preparation stay outside
 * transaction callbacks. A failed initialization closes the connection and preserves the file.
 */
export function initializeDatabase(options: DatabaseOptions) {
  const defaults = options.defaults
  if (!isAbsolute(options.collationExtension)) {
    throw new TypeError('Expected an absolute desktop collation extension path')
  }
  const connection = openConnection(options.path, options.nativeBinding)
  try {
    const existing = inspectFormat(connection, options.migrationsDirectory)
    connection.loadExtension(options.collationExtension)
    configureConnection(connection)
    // Pending migrations may write names; reopen existing indexes with their own comparator first.
    const existingOrder = existing ? openNameOrder(connection) : undefined
    const db = drizzle({ client: connection, relations })
    migrate(db, { migrationsFolder: options.migrationsDirectory })
    const adoptLocale = existingOrder ?? openNameOrder(connection)

    const preferences = createPreferencesTable(defaults)
    if (!db.select({ id: preferences.id }).from(preferences).get()) {
      db.insert(preferences)
        .values({ id: 1, ...preparePreferences(defaults) })
        .run()
    }

    return {
      db,
      preferences,
      adoptLocale,
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
