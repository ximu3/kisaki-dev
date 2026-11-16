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
  const runtime = buildDirectory(hostTarget())
  await info.attach('build.json', {
    body: await readFile(join(runtime, 'build.json')),
    contentType: 'application/json',
  })

  const page = await desktop.firstWindow()
  await page.getByRole('button', { name: 'Task center', exact: true }).waitFor()

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
          // A resize queries the actual native window state. Observe its own request and reply.
          return new Promise<void>((resolve, reject) => {
            const send = (
              Object.getOwnPropertyDescriptor(MessagePort.prototype, 'postMessage') as {
                value: MessagePort['postMessage']
              }
            ).value
            MessagePort.prototype.postMessage = function (this: MessagePort, frame: unknown) {
              if (
                frame &&
                typeof frame === 'object' &&
                'method' in frame &&
                frame.method === 'window.state' &&
                'id' in frame
              ) {
                MessagePort.prototype.postMessage = send
                /** Completes the latency sample only for the matching real window-state response. */
                const reply = (event: MessageEvent<{ id?: number; type: string }>) => {
                  if (event.data.id !== frame.id) {
                    return
                  }
                  this.removeEventListener('message', reply)
                  if (event.data.type === 'success') {
                    resolve()
                  } else {
                    reject(new Error('Native window state query failed'))
                  }
                }
                this.addEventListener('message', reply)
              }
              send.call(this, frame)
            }
            window.dispatchEvent(new Event('resize'))
          })
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
  const ipcP95Ms = ordered[Math.ceil(ordered.length * 0.95) - 1]!
  console.info('Window-to-main IPC P95 (ms):', ipcP95Ms)
  expect(ipcP95Ms, 'window-to-main IPC P95').toBeLessThanOrEqual(100)
})
