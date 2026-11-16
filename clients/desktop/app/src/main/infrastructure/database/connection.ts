/** @fileoverview Establishes and verifies the desktop library's SQLite connection settings. */

import type Database from 'better-sqlite3'

/**
 * Configures connection-local constraints and FULL durability before the first file-identity write.
 *
 * macOS additionally requests fullfsync. Unsupported settings fail without selecting weaker ones.
 */
export function configureConnection(connection: Database.Database): void {
  connection.pragma('foreign_keys = ON')
  connection.pragma('synchronous = FULL')
  // Bound the page-cache target while keeping the representative working indexes resident.
  connection.pragma('cache_size = -32768')
  if (process.platform === 'darwin') {
    connection.pragma('fullfsync = ON')
  }

  if (
    connection.pragma('foreign_keys', { simple: true }) !== 1 ||
    connection.pragma('synchronous', { simple: true }) !== 2 ||
    (process.platform === 'darwin' && connection.pragma('fullfsync', { simple: true }) !== 1)
  ) {
    throw new Error('The database filesystem could not provide the required durability settings')
  }
}

/** Enables WAL on an identified library and verifies the journaling mode SQLite actually selected. */
export function enableWal(connection: Database.Database): void {
  if (connection.pragma('journal_mode = WAL', { simple: true }) !== 'wal') {
    throw new Error('The database filesystem could not provide WAL')
  }
}
