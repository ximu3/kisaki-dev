/** @fileoverview Composes the synchronous operations executed by the desktop application's single SQLite writer. */

import { serveDatabase } from '../infrastructure/database/executor/serve'
import type { Storage } from '../infrastructure/database'
import { verifyExistingLibrary, type DatabaseOptions } from '../infrastructure/database/initialize'
import { attachmentStorage } from '../infrastructure/attachments/storage'
import { preferenceStorage } from '../features/preferences/storage'
import { taskHistory } from '../features/tasks/history'
import { themeStorage } from '../features/appearance/storage'
import { fontStorage } from '../features/fonts/storage'

/** Installs each owner's storage operations on the initialized worker connection. */
function operations(storage: Storage, options: DatabaseOptions) {
  return {
    /** Checks another selected root without migrating it or acquiring a second writer. */
    inspectLibrary(path: string) {
      verifyExistingLibrary(path, options)
    },
    ...attachmentStorage(storage),
    ...preferenceStorage(storage),
    ...taskHistory(storage),
    ...themeStorage(storage),
    ...fontStorage(storage),
  }
}

/** Typed main-to-worker operation table. */
export type ApplicationOperations = ReturnType<typeof operations>

serveDatabase(operations)
