import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { appRoot } from '../lib/paths'
import { electronExecutable } from './electron-executable'

/** One actual Electron process, including its closure and idempotent graceful shutdown. */
export interface DevelopmentProcess {
  readonly pid: number
  readonly closed: Promise<void>
  stop(): Promise<void>
}

/** Start a built generation and resolve only after that program reports readiness. */
export async function startElectron(
  directory: string,
  profile: string,
  rendererUrl: string,
  buildId: string,
  signal?: AbortSignal,
): Promise<DevelopmentProcess> {
  signal?.throwIfAborted()
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
  let ended = false
  const closed = new Promise<void>((resolve) =>
    child.once('close', () => {
      ended = true
      resolve()
    }),
  )
  let stopping: Promise<void> | undefined

  /** Request normal shutdown and retain ownership until the process and streams have closed. */
  function stop(): Promise<void> {
    stopping ??= (async () => {
      if (ended) return
      // A development child has ten seconds to finish its normal application shutdown.
      const timeout = setTimeout(() => child.kill(), 10_000)
      try {
        if (child.connected) {
          child.send({ type: 'shutdown' }, (error) => {
            if (error && !ended) child.kill()
          })
        } else {
          child.kill()
        }
        await closed
      } finally {
        clearTimeout(timeout)
      }
    })()
    return stopping
  }

  let timeout: NodeJS.Timeout | undefined
  let onMessage: ((message: unknown) => void) | undefined
  let onExit: (() => void) | undefined
  let onError: ((cause: Error) => void) | undefined
  let onAbort: (() => void) | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Electron readiness timed out')), 30_000)
      onExit = () => reject(new Error('Electron exited before the application became ready'))
      onError = reject
      onAbort = () => reject(signal?.reason)
      onMessage = (message) => {
        if (
          message &&
          typeof message === 'object' &&
          'type' in message &&
          message.type === 'ready' &&
          'buildId' in message &&
          message.buildId === buildId
        ) {
          resolve()
        }
      }
      child.once('exit', onExit)
      child.once('error', onError)
      child.on('message', onMessage)
      signal?.addEventListener('abort', onAbort, { once: true })
      if (signal?.aborted) onAbort()
    })
    signal?.throwIfAborted()
    if (!child.pid) throw new Error('Electron process identity is unavailable')
    return { pid: child.pid, closed, stop }
  } catch (cause) {
    await stop()
    throw cause
  } finally {
    if (timeout) clearTimeout(timeout)
    if (onMessage) child.off('message', onMessage)
    if (onExit) child.off('exit', onExit)
    if (onError) child.off('error', onError)
    if (onAbort) signal?.removeEventListener('abort', onAbort)
  }
}
