/** @fileoverview Runs the complete storage workload in a worker attached to real Electron and records plans and distributions. */

import { expect, test } from '../support/electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import type { measureStorage } from './storage/measurement'

test.use({ storagePerformance: join(import.meta.dirname, '../../out/performance/worker.js') })

test('worker operation medians meet their budget and the window reaches main during the complete workload', async ({
  desktop,
  profile,
}, info) => {
  const runtime = buildDirectory(hostTarget())
  const process = desktop.process()
  const page = await desktop.firstWindow()
  let measure = true
  const latencies: number[] = []
  const probe = (async () => {
    while (measure) {
      const start = performance.now()
      await page.evaluate(() =>
        (window as typeof window & { fixture: { ping(): Promise<boolean> } }).fixture.ping(),
      )
      latencies.push(performance.now() - start)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  })()
  const reportPath = join(profile, 'storage-performance.json')
  try {
    await expect
      .poll(
        async () => {
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
  } finally {
    measure = false
    await probe
  }

  await info.attach('window-response.json', {
    body: JSON.stringify(latencies),
    contentType: 'application/json',
  })
  const raw = await readFile(reportPath, 'utf8')
  await info.attach('storage.json', { body: raw, contentType: 'application/json' })
  await info.attach('build.json', {
    body: await readFile(join(runtime, 'build.json')),
    contentType: 'application/json',
  })

  const report = JSON.parse(raw) as Awaited<ReturnType<typeof measureStorage>>
  const operations = [
    ...report.queries,
    { name: 'durable short transaction', ...report.shortTransaction },
  ]
  console.table(
    operations.map((operation) => ({
      name: operation.name,
      firstReadMs: 'firstReadMs' in operation ? operation.firstReadMs.toFixed(3) : '',
      medianMs: operation.medianMs.toFixed(3),
      p95Ms: operation.p95Ms.toFixed(3),
      maxMs: operation.maxMs.toFixed(3),
    })),
  )

  for (const { name, medianMs } of operations) {
    expect
      .soft(medianMs, `${name} worker median (ms)`)
      .toBeLessThanOrEqual(report.workerMedianBudgetMs)
  }

  expect(latencies.length).toBeGreaterThan(1)
  const ordered = latencies.toSorted((left, right) => left - right)
  expect(
    ordered[Math.ceil(ordered.length * 0.95) - 1],
    'window-to-main IPC P95',
  ).toBeLessThanOrEqual(100)
})
