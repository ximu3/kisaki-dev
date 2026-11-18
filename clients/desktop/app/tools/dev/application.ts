/** @fileoverview Launches the source application with its own profile and controls readiness and normal exit over RPC. */

import { spawn } from 'node:child_process'
import { addAbortListener } from 'node:events'
import { RpcConnection } from '@kisaki3/desktop-rpc'
import {
  developmentProtocolId,
  developmentProtocolVersion,
  parseDevelopmentReady,
  parseDevelopmentStopResult,
} from '@kisaki3/desktop-contracts/development'
import {
  startDevelopmentSession,
  type DevelopmentApplication,
  type DevelopmentLaunchOptions,
  type DevelopmentOptions,
} from './session'
import { appRoot } from '../lib/paths'

/** Starts the complete source program with a budget covering a cold developer toolchain and the real renderer graph. */
export function startSourceSession(
  options: Pick<DevelopmentOptions, 'signal' | 'onState' | 'profile' | 'prepared'> = {},
) {
  return startDevelopmentSession({
    ...options,
    sourceRoot: appRoot,
    launch: launchApplication,
    startupTimeoutMs: 90_000,
  })
}

/** Owns the actual child and reports a cancelled stop without discarding its running directory. */
export async function launchApplication(
  options: DevelopmentLaunchOptions,
): Promise<DevelopmentApplication> {
  options.signal.throwIfAborted()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(options.executable, [...options.args, '--profile=' + options.profile], {
    cwd: options.cwd,
    env,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => resolve({ code, signal }))
    },
  )
  const ready = Promise.withResolvers<void>()
  const rpc = new RpcConnection(
    {
      /** Binds transport reads and disconnects to the spawned application. */
      start(receive, closed) {
        child.on('message', receive)
        child.once('disconnect', closed)
        child.once('error', closed)
      },
      /** Sends one ordered development frame through the child IPC channel. */
      send(frame) {
        child.send(frame, (error) => {
          if (error) {
            ready.reject(error)
          }
        })
      },
      /** Releases this launcher's end of the child connection. */
      close() {
        if (child.connected) {
          child.disconnect()
        }
      },
    },
    {
      protocol: { id: developmentProtocolId, version: developmentProtocolVersion },
      handshake: {
        role: 'initiator',
        context: {},
        /** Verifies the exact build the launcher prepared. */
        accepts: (value) =>
          !!value &&
          typeof value === 'object' &&
          'buildId' in value &&
          value.buildId === options.buildId,
      },
      notifications: {
        topics: {
          /** Checks the reported build before acknowledging application readiness. */
          ready(value) {
            const state = parseDevelopmentReady(value)
            if (state.buildId === options.buildId) {
              ready.resolve()
            } else {
              ready.reject(new Error('Source application reported a different build'))
            }
          },
        },
        /** Reports invalid readiness notifications to the waiting launcher. */
        onError: (error) => ready.reject(error),
      },
    },
  )
  void rpc.closed.then(ready.reject)
  const timer = setTimeout(
    () => ready.reject(new Error('Source application startup timed out')),
    options.startupTimeoutMs,
  )
  const cancel = addAbortListener(options.signal, () => ready.reject(options.signal.reason))
  /** Terminates the owned child and waits for actual process exit. */
  const terminate = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
    await exited
  }
  try {
    await Promise.all([rpc.ready, ready.promise])
  } catch (error) {
    await terminate()
    throw error
  } finally {
    clearTimeout(timer)
    cancel[Symbol.dispose]()
  }
  return {
    pid: child.pid!,
    exited,
    terminate,
    /** Requests normal stop and preserves a refused application. */
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) {
        await exited
        return 'exited'
      }
      const result = parseDevelopmentStopResult(await rpc.request('stop'))
      if (result.outcome === 'cancelled') {
        return 'cancelled'
      }
      if (result.outcome === 'failed') {
        throw new Error(result.error.message)
      }
      await exited
      return 'exited'
    },
  }
}
