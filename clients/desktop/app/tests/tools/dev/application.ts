import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { debuglog } from 'node:util'
import {
  UnconfirmedApplicationExit,
  type DevelopmentApplication,
  type DevelopmentLaunchOptions,
} from '../../../tools/dev/session'

const debug = debuglog('kisaki:fixture-launch')

export async function launchFixtureApplication(
  options: DevelopmentLaunchOptions,
): Promise<DevelopmentApplication> {
  options.signal.throwIfAborted()

  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const child = spawn(options.executable, [...options.args, `--profile=${options.profile}`], {
    cwd: options.cwd,
    env,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  child.stdout!.pipe(process.stdout, { end: false })
  child.stderr!.pipe(process.stderr, { end: false })
  await once(child, 'spawn')

  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => {
        debug('Application %d streams closed: %s', child.pid, signal ?? code)
        resolve({ code, signal })
      })
    },
  )
  void exited.catch(() => undefined)

  const terminate = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
    await exited
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  let abort: (() => void) | undefined
  let message: ((value: unknown) => void) | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      message = (value) => {
        if (
          value &&
          typeof value === 'object' &&
          'type' in value &&
          value.type === 'fixture-ready'
        ) {
          if ('buildId' in value && value.buildId === options.buildId) {
            resolve()
          } else {
            reject(new Error('Fixture build identity mismatch'))
          }
        }
      }

      child.on('message', message)
      abort = () => reject(options.signal.reason)
      options.signal.addEventListener('abort', abort, { once: true })
      timer = setTimeout(
        () => reject(new Error(`Fixture application ${child.pid} startup timed out`)),
        options.startupTimeoutMs,
      )
      void exited.then(
        ({ code, signal }) =>
          reject(new Error(`Fixture application exited before readiness (${signal ?? code})`)),
        reject,
      )
      if (options.signal.aborted) {
        abort()
      }
    })
  } catch (cause) {
    try {
      await terminate()
    } catch (failure) {
      throw new UnconfirmedApplicationExit(
        [cause, failure],
        'Fixture startup and termination failed',
        {
          cause: failure,
        },
      )
    }
    throw cause
  } finally {
    clearTimeout(timer)
    if (abort) {
      options.signal.removeEventListener('abort', abort)
    }
    if (message) {
      child.off('message', message)
    }
  }

  let stopping: Promise<'cancelled' | 'exited'> | undefined

  return {
    pid: child.pid!,
    exited,
    terminate,
    stop() {
      stopping ??= (async () => {
        if (child.exitCode !== null || child.signalCode !== null) {
          await exited
          return 'exited' as const
        }

        let cancelled: ((value: unknown) => void) | undefined
        let deadline: ReturnType<typeof setTimeout> | undefined
        try {
          return await Promise.race([
            exited.then(() => 'exited' as const),
            new Promise<'cancelled'>((resolve, reject) => {
              cancelled = (value) => {
                if (
                  value &&
                  typeof value === 'object' &&
                  'type' in value &&
                  value.type === 'fixture-cancelled'
                ) {
                  resolve('cancelled')
                }
              }
              child.on('message', cancelled)
              deadline = setTimeout(
                () =>
                  reject(
                    new Error(
                      `Fixture shutdown timed out: pid=${child.pid}, exitCode=${child.exitCode}, signal=${child.signalCode}, connected=${child.connected}`,
                    ),
                  ),
                10_000,
              )
              debug('Requesting application %d to stop', child.pid)
              child.send({ type: 'fixture-stop' }, (cause) => {
                if (cause) {
                  reject(cause)
                }
              })
            }),
          ])
        } finally {
          if (cancelled) {
            child.off('message', cancelled)
          }
          clearTimeout(deadline)
        }
      })().finally(() => {
        stopping = undefined
      })
      return stopping
    },
  }
}
