import { serveDatabase } from '../infrastructure/database/executor/serve'
import type { Storage } from '../infrastructure/database'
import { verifyExistingLibrary, type DatabaseOptions } from '../infrastructure/database/initialize'
import { attachmentStorage } from '../infrastructure/attachments/storage'
import { preferenceStorage } from '../features/preferences/storage'
import { taskHistory } from '../features/tasks/history'
import { themeStorage } from '../features/appearance/storage'
import { fontStorage } from '../features/fonts/storage'
import { libraryStorage } from '../features/library/storage'

function operations(storage: Storage, options: DatabaseOptions) {
  return {
    inspectLibrary(path: string) {
      verifyExistingLibrary(path, options)
    },
    ...attachmentStorage(storage),
    ...preferenceStorage(storage),
    ...taskHistory(storage),
    ...themeStorage(storage),
    ...fontStorage(storage),
    ...libraryStorage(storage),
  }
}

export type ApplicationOperations = ReturnType<typeof operations>

serveDatabase(operations)
