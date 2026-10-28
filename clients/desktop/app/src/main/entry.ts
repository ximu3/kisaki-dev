/**
 * @fileoverview Starts the Electron main process and reports fatal application
 * initialization failures.
 */

import { app } from 'electron'
import { bootstrap } from './app/bootstrap'
import { logFailure } from './infrastructure/log'

// Main-module evaluation must finish so Electron can emit ready.
void bootstrap().catch((cause: unknown) => {
  logFailure('app', cause)
  app.exit(1)
})
