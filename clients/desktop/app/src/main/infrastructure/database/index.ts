/** @fileoverview Exposes database initialization and synchronous storage types to the main-process composition. */

export { initializeDatabase, DatabaseFormatError } from './initialize'
export type { DatabaseOptions, Storage, StorageTransaction } from './initialize'
