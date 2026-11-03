/**
 * @fileoverview Controls a development-test worker, records bounded observations and
 * exposes its lifecycle to tests.
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { onTestFailed, onTestFinished } from 'vitest'
import type { DevelopmentBuild } from '../../tools/dev/session'

/** Three minutes cover cold package/native preparation and readiness; the application handshake has its own deadline. */
const developmentStartupTimeoutMs = 180_000

/** Observations from the isolated development worker, separate from the application protocol. */
export interface DevelopmentObservation {
  state: 'building' | 'failed' | 'ready' | 'stopped' | 'cancelled'
  current?: DevelopmentBuild
  rendererUrl?: string
  error?: string
}

/** Fixture behavior and the worker result that the owning test expects. */
interface DevelopmentControllerOptions {
  scenario?: 'normal' | 'stop-failure' | 'cancel-first-close'
  expectedExitCode?: number
}

/** Start a test-owned worker with optional application behavior; register input restoration first. */
export function startDevelopmentController(
  app: string,
  options: DevelopmentControllerOptions = {},
) {
  const startedAt = new Date().toISOString()
  const start = performance.now()
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'tests/support/development-worker.ts', options.scenario ?? 'normal'],
    {
      cwd: app,
      windowsHide: true,
      env: {
        ...process.env,
        NODE_DEBUG: [process.env.NODE_DEBUG, 'kisaki:*'].filter(Boolean).join(','),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  )

  const states: DevelopmentObservation[] = []
  const observations: { elapsedMs: number; observation: DevelopmentObservation }[] = []
  let output = ''
  let resolveReady!: () => void
  child.on('message', (message: DevelopmentObservation) => {
    states.push(message)
    observations.push({ elapsedMs: performance.now() - start, observation: message })
    if (observations.length > 32) {
      observations.shift()
    }
    if (message.state === 'ready') {
      resolveReady()
    }
  })

  for (const stream of [child.stdout!, child.stderr!]) {
    stream.setEncoding('utf8').on('data', (chunk: string) => {
      output = (output + chunk).slice(-16_384)
    })
  }

  const closed = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })
  let startupTimeout: ReturnType<typeof setTimeout>
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    startupTimeout = setTimeout(
      () => reject(new Error(`Development worker ${child.pid} startup timed out`)),
      developmentStartupTimeoutMs,
    )
    void closed.then(
      (code) => reject(new Error(`Development worker exited before readiness (${code})`)),
      reject,
    )
  })
  // Startup cancellation need not await ready; keep its rejection available without an unhandled promise.
  void ready.then(
    () => clearTimeout(startupTimeout),
    () => clearTimeout(startupTimeout),
  )

  // Vitest runs this after cleanup, including when a cleanup hook caused the failure.
  onTestFailed(() => {
    console.error(`Development worker ${child.pid}:\n${JSON.stringify(observations)}\n${output}`)
  })

  onTestFinished(async () => {
    const directory = join('test-results', 'dev', 'controllers')
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, `${process.pid}-${child.pid ?? 'unstarted'}.json`),
      JSON.stringify(
        {
          startedAt,
          workerPid: child.pid,
          elapsedMs: performance.now() - start,
          observations,
          output,
          exitCode: child.exitCode,
          signalCode: child.signalCode,
        },
        null,
        2,
      ),
    )
  })
  // Vitest preserves the test failure and every cleanup error, and writes the report after closure.
  onTestFinished(async () => {
    if (child.connected) {
      child.send({ type: 'cleanup' })
    }

    let forced = false
    const timeout = setTimeout(() => {
      forced = true
      child.kill('SIGKILL')
    }, 15_000)
    try {
      const code = await closed
      if (forced) {
        throw new Error(`Development worker ${child.pid} required forced termination`)
      }
      const expectedExitCode = options.expectedExitCode ?? 0
      if (code !== expectedExitCode) {
        throw new Error(
          `Development worker ${child.pid} exited with ${child.signalCode ?? code}; expected ${expectedExitCode}`,
        )
      }
    } finally {
      clearTimeout(timeout)
    }
  })

  return {
    process: child,
    states,
    ready,
    closed,
    get output() {
      return output
    },
  }
}
