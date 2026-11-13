/** @fileoverview Opens the selected SQLite driver and establishes the application's durable synchronous connection. */

import Database from 'better-sqlite3'
import { isAbsolute } from 'node:path'
import { nameOrderKey } from './text/name-order'

/** Opens one explicit database file with the matching deployed native binding. */
export function openConnection(path: string, nativeBinding: string): Database.Database {
  if (!isAbsolute(path) || !isAbsolute(nativeBinding)) {
    throw new TypeError('Database and native binding paths must be absolute')
  }
  const connection = new Database(path, { nativeBinding })
  connection.function('kisaki_name_key_v1', { deterministic: true }, (value: string | null) =>
    nameOrderKey(value),
  )
  return connection
}

/**
 * Enables and verifies foreign keys, WAL and FULL durability before business writes.
 *
 * macOS additionally requests fullfsync. Unsupported settings fail without selecting weaker ones.
 */
export function configureConnection(connection: Database.Database): void {
  connection.pragma('foreign_keys = ON')
  connection.pragma('journal_mode = WAL')
  connection.pragma('synchronous = FULL')
  // Bound the page-cache target while keeping the representative working indexes resident.
  connection.pragma('cache_size = -32768')
  if (process.platform === 'darwin') {
    connection.pragma('fullfsync = ON')
  }

  if (
    connection.pragma('foreign_keys', { simple: true }) !== 1 ||
    connection.pragma('journal_mode', { simple: true }) !== 'wal' ||
    connection.pragma('synchronous', { simple: true }) !== 2 ||
    (process.platform === 'darwin' && connection.pragma('fullfsync', { simple: true }) !== 1)
  ) {
    throw new Error('The database filesystem could not provide the required durability settings')
  }
}
