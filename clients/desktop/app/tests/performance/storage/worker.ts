/** @fileoverview Runs the storage workload in an Electron worker and returns its finished JSON report. */

import { parentPort, workerData } from 'node:worker_threads'
import { measureStorage } from './measurement'
import type { StorageMeasurementInput } from './measurement'

/** Completed workload including index rebuilds, query plans and environment. */
const report = await measureStorage(workerData as StorageMeasurementInput)
parentPort!.postMessage(JSON.stringify(report, null, 2))
