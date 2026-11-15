/** @fileoverview Holds the application's SQLite connection inside its dedicated serial worker. */

import { parentPort, workerData } from 'node:worker_threads'
import { initializeDatabase, type DatabaseOptions } from '../initialize'
import type { DatabaseCommand } from './index'

/** Dedicated main-to-database channel. */
const port = parentPort!

/** This worker's only connection, opened after main verifies the selected local filesystem. */
const storage = initializeDatabase(workerData as DatabaseOptions)
port.on('message', (command: DatabaseCommand) => {
  try {
    if (command.type === 'close') {
      try {
        storage.close()
        port.postMessage({ closed: true })
      } catch (error) {
        port.postMessage({ closed: true, error })
      } finally {
        port.close()
      }
      return
    } else if (command.type === 'preferences') {
      port.postMessage({ value: storage.db.select().from(storage.preferences).get() })
      return
    } else {
      storage.adoptLocale(command.locale)
    }
    port.postMessage({})
  } catch (error) {
    port.postMessage({ error })
  }
})
port.postMessage({ ready: true })
