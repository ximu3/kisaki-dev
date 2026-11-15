/** @fileoverview Hosts a single storage measurement inside the Electron process controlled by Playwright. */

import type { ElectronApplication } from '@playwright/test'
import type { StorageMeasurementInput } from './measurement'

/** Returns the worker's report after a clean exit and propagates its original failure. */
export async function runStorageWorker(
  desktop: ElectronApplication,
  input: StorageMeasurementInput & { entry: string },
): Promise<string> {
  const result = await desktop.evaluate(async (_, { entry, ...workerData }) => {
    const { Worker } = process.getBuiltinModule('node:worker_threads')
    const worker = new Worker(entry, { workerData })
    let report: string | undefined
    let failure: Error | undefined

    worker.once('message', (value: string) => {
      report = value
    })
    worker.once('error', (error: Error) => {
      failure = error
    })
    const status = await new Promise<number>((resolve) => worker.once('exit', resolve))

    if (failure) {
      // Playwright's value serializer preserves the worker error's name, message and stack.
      return failure
    }
    if (status !== 0 || report === undefined) {
      return new Error(`Storage worker exited with status ${status} before completing its report`)
    }
    return report
  }, input)

  if (result instanceof Error) {
    throw result
  }
  return result
}
