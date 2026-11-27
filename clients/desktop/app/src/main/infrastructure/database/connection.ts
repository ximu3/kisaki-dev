import type Database from 'better-sqlite3'

export function configureConnection(connection: Database.Database): void {
  connection.function('kisaki_lower', { deterministic: true }, (text: string) => text.toLowerCase())
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

export function enableWal(connection: Database.Database): void {
  if (connection.pragma('journal_mode = WAL', { simple: true }) !== 'wal') {
    throw new Error('The database filesystem could not provide WAL')
  }
}
