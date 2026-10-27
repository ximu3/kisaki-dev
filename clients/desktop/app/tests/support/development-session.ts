import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { onTestFinished } from 'vitest'
import type { DevelopmentBuild } from '../../tools/dev/session'

/** Observations from the isolated test controller, separate from the application protocol. */
export interface DevelopmentObservation {
  state: 'building' | 'failed' | 'ready' | 'stopped' | 'cancelled'
  current?: DevelopmentBuild
  rendererUrl?: string
  error?: string
}

/** Start the real controller and retain its bounded test trace; close it before restoring the workspace. */
export function startDevelopmentController(app: string) {
  const startedAt = new Date().toISOString()
  const start = performance.now()
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'tests/support/development-controller.ts'],
    {
      cwd: app,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  )
  const states: DevelopmentObservation[] = []
  const observations: { elapsedMs: number; observation: DevelopmentObservation }[] = []
  let output = ''
  child.on('message', (message: DevelopmentObservation) => {
    states.push(message)
    observations.push({ elapsedMs: performance.now() - start, observation: message })
    if (observations.length > 32) observations.shift()
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

  onTestFinished(async () => {
    const directory = join('test-results', 'dev', 'controllers')
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, `${process.pid}-${child.pid ?? 'unstarted'}.json`),
      JSON.stringify(
        {
          startedAt,
          controllerPid: child.pid,
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

  return {
    process: child,
    states,
    closed,
    diagnostics: () => `${JSON.stringify(observations)}\n${output}`,
    async close() {
      if (child.connected) child.send({ type: 'stop' })
      const timeout = setTimeout(() => child.kill('SIGKILL'), 15_000)
      try {
        await closed
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}
