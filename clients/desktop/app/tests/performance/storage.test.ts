/** @fileoverview Runs the complete storage workload in a real Electron main process and records plans and distributions. */

import { expect, test } from '../support/electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import type { measureStorage } from '../fixtures/runtime/src/main/storage/measurement'

test.use({ storagePerformance: true })

test('all storage statements fit the fixed main-thread budget on the full representative database', async ({
  desktop,
  profile,
}, info) => {
  const runtime = buildDirectory(hostTarget())
  await desktop.firstWindow()
  const reportPath = join(profile, 'storage-performance.json')
  await expect
    .poll(
      async () => {
        const process = desktop.process()
        if (process.exitCode !== null || process.signalCode !== null) {
          throw new Error(
            `Storage measurement process exited (${process.signalCode ?? process.exitCode})`,
          )
        }
        try {
          await readFile(reportPath)
          return true
        } catch (error) {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
            throw error
          }
          return false
        }
      },
      { timeout: 150_000, intervals: [1000] },
    )
    .toBe(true)
  const raw = await readFile(reportPath, 'utf8')
  const report = JSON.parse(raw) as Awaited<ReturnType<typeof measureStorage>>
  await info.attach('storage.json', { body: raw, contentType: 'application/json' })
  await info.attach('build.json', {
    body: await readFile(join(runtime, 'build.json')),
    contentType: 'application/json',
  })
  for (const query of report.queries) {
    expect(Math.max(query.firstReadMs, query.maxMs), query.name).toBeLessThanOrEqual(
      report.workload.synchronousBudgetMs,
    )
  }
  expect(Math.max(...report.writeSamplesMs), 'durable short transaction').toBeLessThanOrEqual(
    report.workload.synchronousBudgetMs,
  )
})
