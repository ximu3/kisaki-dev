import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { electronExecutable } from './electron-executable'
import type { DevelopmentReady } from '../../src/shared/development-session'

/** Request shutdown and wait for process closure, terminating after a 10-second grace period. */
export async function stopElectron(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolveStop) => {
    const timeout = setTimeout(() => child.kill(), 10_000)
    child.once('close', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    if (child.connected) child.send({ type: 'shutdown' })
    else child.kill()
  })
}

/** Spawn a built generation and resolve when that build reports application readiness. */
export async function startElectron(
  directory: string,
  profile: string,
  rendererUrl: string,
  buildId: string,
): Promise<ChildProcess> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    KISAKI_DEV_PROFILE: profile,
    KISAKI_RENDERER_URL: rendererUrl,
  }
  delete env.ELECTRON_RUN_AS_NODE

  const child = spawn(electronExecutable(), [join(directory, 'main', 'entry.js')], {
    cwd: appRoot,
    env,
    windowsHide: false,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })

  try {
    await new Promise<void>((resolveReady, reject) => {
      const timeout = setTimeout(() => reject(new Error('Electron readiness timed out')), 30_000)

      const onExit = () => {
        clearTimeout(timeout)
        reject(new Error('Electron exited before the application became ready'))
      }

      child.once('error', reject)
      child.once('exit', onExit)
      child.on('message', (message: DevelopmentReady) => {
        if (message.type !== 'ready' || message.buildId !== buildId) return
        clearTimeout(timeout)
        child.off('exit', onExit)
        resolveReady()
      })
    })

    return child
  } catch (cause) {
    if (child.pid) await stopElectron(child)
    throw cause
  }
}
