/** @fileoverview Confirms that an independently bundled utility process can start and send a message. */

import type {} from 'electron'

process.parentPort.on('message', () => process.exit(0))
process.parentPort.postMessage({ type: 'fixture-worker-ready' })
