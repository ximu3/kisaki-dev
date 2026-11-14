/** @fileoverview Exposes the main-owned serial executor and its worker-side storage operations. */

export { initializeDatabase, DatabaseFormatError } from './initialize'
export type { DatabaseOptions, Storage, StorageTransaction } from './initialize'

export { openDatabaseExecutor } from './executor'
