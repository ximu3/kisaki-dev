import { spawn } from 'node:child_process'
import type { DevelopmentBuild } from '../../tools/dev/session'

/** Observations from the isolated test controller, separate from the application protocol. */
export interface DevelopmentObservation {
  state: 'building' | 'failed' | 'ready' | 'stopped' | 'cancelled'
  current?: DevelopmentBuild
  rendererUrl?: string
}

/** Start the real development controller; close it before removing or restoring its workspace. */
export function startDevelopmentController(app: string) {
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
  let output = ''
  child.on('message', (message: DevelopmentObservation) => states.push(message))
  for (const stream of [child.stdout!, child.stderr!]) {
    stream.setEncoding('utf8').on('data', (chunk: string) => {
      output = (output + chunk).slice(-16_384)
    })
  }
  const closed = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })

  return {
    process: child,
    states,
    closed,
    diagnostics: () => output,
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
