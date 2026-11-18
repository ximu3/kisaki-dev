/** @fileoverview Dispatches serial database work on the worker that owns the SQLite connection. */

import { parentPort, workerData } from 'node:worker_threads'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { initializeDatabase, type DatabaseOptions, type Storage } from '../initialize'
import type { DatabaseCommand } from './index'

/** Opens storage once and serves the synchronous operation table supplied by the composition root. */
export function serveDatabase(
  createOperations: (
    storage: Storage,
    options: DatabaseOptions,
  ) => Record<string, (...args: never[]) => unknown>,
) {
  const port = parentPort!
  const options = workerData as DatabaseOptions
  const storage = initializeDatabase(options)
  const operations = createOperations(storage, options)

  port.on('message', (command: DatabaseCommand) => {
    try {
      switch (command.type) {
        case 'close':
          try {
            storage.close()
            port.postMessage({ closed: true })
          } catch (error) {
            port.postMessage({ closed: true, error })
          } finally {
            port.close()
          }
          return
        case 'adopt-locale':
          storage.adoptLocale(command.locale)
          port.postMessage({})
          return
        case 'operation':
          port.postMessage({ value: operations[command.name]!(...(command.args as never[])) })
      }
    } catch (error) {
      if (error instanceof DesktopError) {
        port.postMessage({ failure: { code: error.code, message: error.message } })
      } else {
        port.postMessage({ error })
      }
    }
  })
  port.postMessage({ ready: true })
}
