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
  UnconfirmedApplicationExit,
  type DevelopmentApplication,
  type DevelopmentLaunchOptions,
  type DevelopmentOptions,
} from './session'
import { appRoot } from '../lib/paths'

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
  void exited.catch(() => {})
  const ready = Promise.withResolvers<void>()
  const rpc = new RpcConnection(
    {
      start(receive, closed) {
        child.on('message', receive)
        child.once('disconnect', closed)
        child.once('error', closed)
      },
      send(frame) {
        child.send(frame, (error) => {
          if (error) {
            ready.reject(error)
          }
        })
      },
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
        accepts: (value) =>
          !!value &&
          typeof value === 'object' &&
          'buildId' in value &&
          value.buildId === options.buildId,
      },
      notifications: {
        topics: {
          ready(value) {
            const state = parseDevelopmentReady(value)
            if (state.buildId === options.buildId) {
              ready.resolve()
            } else {
              ready.reject(new Error('Source application reported a different build'))
            }
          },
        },
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
  const terminate = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
    await exited
  }
  try {
    await Promise.all([rpc.ready, ready.promise])
  } catch (error) {
    try {
      await terminate()
    } catch (cleanup) {
      if (child.pid !== undefined) {
        throw new UnconfirmedApplicationExit(
          [error, cleanup],
          'The source application could not be closed after startup failed',
        )
      }
    }
    throw error
  } finally {
    clearTimeout(timer)
    cancel[Symbol.dispose]()
  }
  return {
    pid: child.pid!,
    exited,
    terminate,
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
