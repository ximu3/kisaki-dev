import { spawn } from 'node:child_process'
import { isAbsolute } from 'node:path'
import {
  developmentProtocolVersion,
  developmentLaunchSwitches,
  parseDevelopmentEvent,
} from '@kisaki3/desktop-contracts/development'
import type {
  DevelopmentCommand,
  DevelopmentEvent,
  DevelopmentReady,
  DevelopmentStopResult,
} from '@kisaki3/desktop-contracts/development'

/** Actual process termination; an IPC disconnect is not this fact. */
export interface DevelopmentProcessExit {
  code: number | null
  signal: NodeJS.Signals | null
}

/** One owned application process. A cancelled stop leaves the same usable connection alive. */
export interface DevelopmentApplication {
  readonly pid: number
  readonly ready: DevelopmentReady
  readonly exited: Promise<DevelopmentProcessExit>
  /** Request normal shutdown, sharing any pending request; resolve exited only after process exit. */
  stop(): Promise<'cancelled' | 'exited'>
  /** Explicitly terminate this owned process, including a disconnected or unresponsive application. */
  terminate(): Promise<DevelopmentProcessExit>
}

/** Launch a real executable directly; source Electron uses its main entry as the first argument. */
export interface DevelopmentApplicationOptions {
  executable: string
  args?: readonly string[]
  cwd: string
  profile: string
  env?: NodeJS.ProcessEnv
  /** Startup cancellation only; normal running shutdown uses stop() and can be refused. */
  signal?: AbortSignal
  /** Optional caller-owned startup budget in milliseconds; never applies to normal shutdown. */
  startupTimeoutMs?: number
  /** Source development verifies that the launched generation is the one just built. */
  buildId?: string
  /** Report a lost or invalid connection without guessing that its process has stopped. */
  onFailure?: (cause: Error) => void
}

/** Start JSON IPC and wait for actual readiness; failed startup terminates only this new child. */
export async function launchDevelopmentApplication(
  options: DevelopmentApplicationOptions,
): Promise<DevelopmentApplication> {
  options.signal?.throwIfAborted()
  if (!isAbsolute(options.executable) || !isAbsolute(options.profile) || !isAbsolute(options.cwd)) {
    throw new Error('Development executable, profile and working directory must be absolute')
  }

  const env = { ...process.env, ...options.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(
    options.executable,
    [
      ...(options.args ?? []),
      `--${developmentLaunchSwitches.mode}`,
      `--${developmentLaunchSwitches.profile}=${options.profile}`,
    ],
    {
      cwd: options.cwd,
      env,
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      serialization: 'json',
      windowsHide: false,
    },
  )
  let exit: DevelopmentProcessExit | undefined
  let resolveExit!: (result: DevelopmentProcessExit) => void
  const exited = new Promise<DevelopmentProcessExit>((resolve) => {
    resolveExit = resolve
  })
  let resolveReady!: (ready: DevelopmentReady) => void
  let rejectReady!: (cause: Error) => void
  const readiness = new Promise<DevelopmentReady>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  let ready = false
  let exiting = false
  let connectionFailure: Error | undefined
  let pendingStop:
    | {
        resolve: (result: DevelopmentStopResult) => void
        reject: (cause: Error) => void
      }
    | undefined
  let stopping: Promise<'cancelled' | 'exited'> | undefined

  /** Settle connection waiters once; readers remain owned until the process actually exits. */
  function fail(cause: Error): void {
    if (connectionFailure) return
    connectionFailure = cause
    rejectReady(cause)
    pendingStop?.reject(cause)
    if (ready) options.onFailure?.(cause)
  }

  /** A send callback confirms transport acceptance, never application execution. */
  function send(message: DevelopmentCommand): void {
    child.send(message, (cause) => {
      if (cause) fail(cause)
    })
  }

  function receive(value: unknown): void {
    try {
      const message: DevelopmentEvent = parseDevelopmentEvent(value)
      if (message.type === 'failed') {
        throw new Error(message.error.message, { cause: message.error })
      }
      if (message.type === 'ready') {
        if (
          ready ||
          message.protocolVersion !== developmentProtocolVersion ||
          (options.buildId !== undefined && message.buildId !== options.buildId)
        ) {
          throw new Error('Development application readiness does not match this launch')
        }
        ready = true
        resolveReady(message)
      } else if (message.type === 'stopResult' && ready) {
        // The application also announces ordinary UI shutdown before disconnecting.
        if (message.outcome === 'exiting') exiting = true
        else if (!pendingStop) throw new Error('Unexpected development stop result')
        pendingStop?.resolve(message)
      } else {
        throw new Error('Unexpected development application event')
      }
    } catch (cause) {
      fail(cause instanceof Error ? cause : new Error('Invalid development application event'))
    }
  }

  child.on('message', receive)
  child.on('error', (cause) => {
    fail(cause)
    if (!child.pid) resolveExit({ code: null, signal: null })
  })
  child.once('exit', (code, signal) => {
    exit = { code, signal }
    resolveExit(exit)
    rejectReady(new Error('Development application exited before readiness'))
    pendingStop?.resolve({ type: 'stopResult', outcome: 'exiting' })
    child.off('message', receive)
  })
  child.once('disconnect', () => {
    if (!exit && !exiting) fail(new Error('Development application IPC disconnected'))
  })
  const cancelStartup = () =>
    rejectReady(
      new Error('Development application startup cancelled', { cause: options.signal?.reason }),
    )
  options.signal?.addEventListener('abort', cancelStartup, { once: true })
  if (options.signal?.aborted) cancelStartup()

  const timeout =
    options.startupTimeoutMs === undefined
      ? undefined
      : setTimeout(
          () => rejectReady(new Error('Development application readiness timed out')),
          options.startupTimeoutMs,
        )
  send({ type: 'initialize', protocolVersion: developmentProtocolVersion })
  try {
    const applicationReady = await readiness
    options.signal?.throwIfAborted()
    if (connectionFailure) throw connectionFailure
    if (exit) throw new Error('Development application exited during readiness')
    if (!child.pid) throw new Error('Development application process identity is unavailable')
    return {
      pid: child.pid,
      ready: applicationReady,
      exited,
      stop() {
        if (exit) return Promise.resolve('exited')
        if (stopping) return stopping
        if (connectionFailure) return Promise.reject(connectionFailure)
        stopping = (async () => {
          if (!exiting) {
            const result = await new Promise<DevelopmentStopResult>((resolve, reject) => {
              pendingStop = { resolve, reject }
              send({ type: 'stop' })
            })
            if (result.outcome === 'cancelled') return 'cancelled'
            if (result.outcome === 'failed') {
              throw new Error(result.error.message, { cause: result.error })
            }
          }
          const result = await exited
          if (result.code !== 0) throw new Error('Development application exited unsuccessfully')
          return 'exited'
        })().finally(() => {
          pendingStop = undefined
          stopping = undefined
        })
        return stopping
      },
      async terminate() {
        if (!exit && child.pid) child.kill('SIGKILL')
        return exited
      },
    }
  } catch (cause) {
    if (!exit && child.pid) child.kill('SIGKILL')
    await exited
    throw cause
  } finally {
    if (timeout) clearTimeout(timeout)
    options.signal?.removeEventListener('abort', cancelStartup)
  }
}
