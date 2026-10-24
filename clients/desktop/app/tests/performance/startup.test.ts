import { _electron, expect, test } from '@playwright/test'
import { cpus, release, totalmem, tmpdir } from 'node:os'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { electronExecutable } from '../../tools/dev/electron-executable'
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { budgets } from './budgets'

test('measures twenty fresh processes and confirms all observed child processes exit', async ({}, info) => {
  const runtime = buildDirectory(hostTarget())
  const profile = await mkdtemp(join(tmpdir(), 'kisaki-performance-'))
  const samples: { milliseconds: number; workingSetKiB: number }[] = []
  try {
    for (let index = 0; index < budgets.samples; index++) {
      const env: Record<string, string> = Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      )
      env.KISAKI_DEV_PROFILE = profile
      delete env.ELECTRON_RUN_AS_NODE
      delete env.KISAKI_RENDERER_URL

      const start = performance.now()
      const application = await _electron.launch({
        executablePath: electronExecutable(),
        args: [join(runtime, 'main/entry.js')],
        env,
      })

      let pids: number[] = []
      try {
        const window = await application.firstWindow()
        await window.getByRole('button', { name: 'Close window' }).waitFor()
        const milliseconds = performance.now() - start
        const metrics = await application.evaluate(({ app }) =>
          app
            .getAppMetrics()
            .map(({ pid, memory }) => ({ pid, workingSetSize: memory.workingSetSize })),
        )
        pids = metrics.map((metric) => metric.pid)
        samples.push({
          milliseconds,
          workingSetKiB: metrics.reduce((sum, metric) => sum + metric.workingSetSize, 0),
        })
      } finally {
        await application.close()
      }

      await expect
        .poll(
          () =>
            pids.filter((pid) => {
              try {
                process.kill(pid, 0)
                return true
              } catch {
                return false
              }
            }),
          { timeout: 5_000 },
        )
        .toEqual([])
    }

    const sorted = samples.map((sample) => sample.milliseconds).sort((a, b) => a - b)
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    const middle = Math.floor(sorted.length / 2)
    const median =
      sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!

    const report = {
      target: hostTarget(),
      osRelease: release(),
      cpu: cpus()[0]?.model,
      memoryBytes: totalmem(),
      mode: 'fresh processes, warm OS disk cache, isolated retained profile, W00 shell only',
      build: JSON.parse(await readFile(join(runtime, 'build.json'), 'utf8')),
      samples,
      medianMs: median,
      p95Ms: p95,
      maxMs: sorted.at(-1),
      standardDeviationMs: Math.sqrt(
        sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length,
      ),
    }
    await info.attach('startup.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    })
    expect(p95).toBeLessThanOrEqual(budgets.engineeringShellStartupP95Ms)
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
})
