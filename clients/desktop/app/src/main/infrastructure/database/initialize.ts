/** @fileoverview Identifies the supported database, applies Drizzle's migration chain and initializes only missing singleton data. */

import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import Database from 'better-sqlite3'
import type { Preferences } from '@kisaki3/desktop-contracts/preferences'
import { isAbsoluteHostPath } from '#host-path'
import { configureConnection, enableWal } from './connection'
import { createPreferencesTable } from './schema/preferences'
import { preparePreferences } from './codecs/preferences'
import { relations } from './relations'
import { openNameOrder } from './name-order'

/** SQLite file identity used to claim an empty library and retained by its formal migration chain. */
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

/** Claims an empty file or reads an owned ledger within a single SQLite transaction. */
function claimOrReadHistory(connection: Database.Database) {
  const objects = connection
    .prepare("select type, name from main.sqlite_schema where name not glob 'sqlite_*'")
    .all() as { type: string; name: string }[]
  const identity = connection.pragma('application_id', { simple: true })
  if (
    identity === 0 &&
    objects.length === 0 &&
    connection.pragma('user_version', { simple: true }) === 0
  ) {
    // Persist ownership before Drizzle creates its ledger so an interrupted first migration is identifiable.
    connection.pragma(`application_id = ${applicationId}`)
    return []
  }
  if (identity !== applicationId) {
    throw new DatabaseFormatError('The file is not a supported Kisaki database')
  }

  if (objects.length === 0) {
    return []
  }
  if (!objects.some(({ type, name }) => type === 'table' && name === '__drizzle_migrations')) {
    throw new DatabaseFormatError('The library is missing its migration ledger')
  }
  const applied = connection
    .prepare('select name, hash from __drizzle_migrations order by id')
    .all() as {
    name: string
    hash: string
  }[]
  if (applied.length === 0 && objects.length !== 1) {
    throw new DatabaseFormatError(
      'The library contains schema objects without an applied migration',
    )
  }
  return applied
}

/** Establishes file ownership and returns whether the library has a verified migration baseline. */
function prepareFormat(connection: Database.Database, migrationsDirectory: string): boolean {
  const applied = connection.transaction(() => claimOrReadHistory(connection))()
  if (applied.length === 0) {
    return false
  }

  const supported = readMigrationFiles({ migrationsFolder: migrationsDirectory })
  if (
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
 * Drizzle connection uses synchronous queries and transactions. Unsupported files retain their
 * contents. A failed first migration closes the connection and leaves the claimed library retryable.
 */
export function initializeDatabase(options: DatabaseOptions) {
  const { path, nativeBinding, collationExtension, migrationsDirectory, defaults } = options
  if (![path, nativeBinding, collationExtension, migrationsDirectory].every(isAbsoluteHostPath)) {
    throw new TypeError('Database, native binding, collation and migration paths must be absolute')
  }
  const connection = new Database(path, { nativeBinding })
  try {
    configureConnection(connection)
    const hasBaseline = prepareFormat(connection, migrationsDirectory)
    connection.loadExtension(collationExtension)
    enableWal(connection)
    // Pending migrations may write names; reopen existing indexes with their own comparator first.
    const existingOrder = hasBaseline ? openNameOrder(connection) : undefined
    const db = drizzle({ client: connection, relations })
    migrate(db, { migrationsFolder: migrationsDirectory })
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
