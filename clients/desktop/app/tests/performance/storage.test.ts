/** @fileoverview Runs the complete storage workload in a worker attached to real Electron and records plans and distributions. */

import { expect, test } from '../support/electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { runStorageWorker } from './storage/host'
import type { measureStorage } from './storage/measurement'

test('worker operation medians meet their budget and the window reaches main during the complete workload', async ({
  desktop,
  profile,
}, info) => {
  test.setTimeout(600_000)
  const runtime = buildDirectory(hostTarget())
  await info.attach('build.json', {
    body: await readFile(join(runtime, 'build.json')),
    contentType: 'application/json',
  })

  const page = await desktop.firstWindow()
  await page.locator('#root').waitFor({ state: 'attached' })

  let measuringStorage = true
  const latencies: number[] = []
  const [workerResult, windowResult] = await Promise.allSettled([
    runStorageWorker(desktop, {
      entry: join(import.meta.dirname, '../../out/performance/worker.js'),
      profile,
      resources: join(runtime, 'resources'),
    }).finally(() => {
      measuringStorage = false
    }),
    (async () => {
      while (measuringStorage) {
        const start = performance.now()
        await page.evaluate(() => {
          const carrier = window as typeof window & {
            fixture: {
              /** Resolves when main services this window's IPC probe. */
              ping(): Promise<boolean>
            }
          }
          return carrier.fixture.ping()
        })
        latencies.push(performance.now() - start)
        await setTimeout(100)
      }
    })(),
  ])

  await info.attach('window-response.json', {
    body: JSON.stringify(latencies),
    contentType: 'application/json',
  })
  if (workerResult.status === 'rejected') {
    if (windowResult.status === 'rejected') {
      throw new AggregateError(
        [workerResult.reason, windowResult.reason],
        'Storage measurement and window sampling failed',
      )
    }
    throw workerResult.reason
  }

  const raw = workerResult.value
  await info.attach('storage.json', { body: raw, contentType: 'application/json' })
  if (windowResult.status === 'rejected') {
    throw windowResult.reason
  }

  const report = JSON.parse(raw) as Awaited<ReturnType<typeof measureStorage>>
  console.info(
    'Storage fixture preparation (ms):',
    report.preparationMs,
    'input:',
    report.inputSha256,
  )
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
