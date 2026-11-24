import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { debuglog } from 'node:util'
import { isCancellation, rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { isAbsoluteHostPath } from '#host-path'
import { appRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { prepareResources } from '../resources/prepare'
import { buildNative } from '../native/build'
import { createRendererServers, type RunningRenderer } from './renderer'
import { startInputWatcher, type PreparationChange } from './inputs'
import { electronExecutable } from './electron-executable'
import { prepareRuntime } from './prepare-runtime'
import { watchPrograms, type ProgramWatch } from './programs'

const debug = debuglog('kisaki:development')

export interface DevelopmentApplication {
  pid: number
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>

  stop(): Promise<'cancelled' | 'exited'>

  terminate(): Promise<void>
}

export interface DevelopmentLaunchOptions {
  executable: string
  args: string[]
  cwd: string

  profile: string
  buildId: string

  signal: AbortSignal
  startupTimeoutMs: number
}

export interface DevelopmentBuild {
  buildId: string
  directory: string
  processId: number
}

export class UnconfirmedApplicationExit extends AggregateError {}

export interface DevelopmentSession {
  readonly ready: Promise<void>
  readonly closed: Promise<void>
  readonly rendererUrl: string
  readonly current: DevelopmentBuild | undefined

  stop(): Promise<'cancelled' | 'stopped'>

  terminate(): Promise<void>
}

export interface DevelopmentOptions {
  sourceRoot: string
  launch: (options: DevelopmentLaunchOptions) => Promise<DevelopmentApplication>
  profile?: string
  startupTimeoutMs?: number
  prepared?: { resources: string; nativeBinding: string }
  signal?: AbortSignal
  onState?: (state: 'building' | 'failed' | 'ready' | 'stopped', error?: unknown) => void
}

export async function startDevelopmentSession(
  options: DevelopmentOptions,
): Promise<DevelopmentSession> {
  if (!isAbsoluteHostPath(options.sourceRoot)) {
    throw new Error('Development source root must be an absolute path')
  }
  const profile = options.profile ?? join(appRoot, '.local', 'development')
  if (!isAbsoluteHostPath(profile)) {
    throw new Error('Development profile must be an absolute path')
  }
  options.signal?.throwIfAborted()

  const target = hostTarget()
  const buildId = randomUUID()
  const controller = new AbortController()
  const signal = controller.signal
  let session: DevelopmentSession | undefined

  const cancelPreparation = () => {
    controller.abort(options.signal?.reason)
    void session?.stop().catch((cause: unknown) => options.onState?.('failed', cause))
  }
  options.signal?.addEventListener('abort', cancelPreparation, { once: true })

  let directory: string | undefined
  const renderers = createRendererServers(options.sourceRoot, buildId)
  let inputs: Awaited<ReturnType<typeof startInputWatcher>> | undefined
  let compilers: ProgramWatch | undefined

  async function closeDevelopmentInputs() {
    const [watchers, servers] = await Promise.all([
      Promise.allSettled([inputs?.close(), compilers?.close()]),
      renderers.closeAll(),
    ])
    return [...watchers, ...servers]
  }

  try {
    const parent = join(appRoot, 'out/development', target)
    await mkdir(parent, { recursive: true })
    const sessionDirectory = await mkdtemp(join(parent, 'session-'))
    directory = sessionDirectory
    const compilerDirectory = join(sessionDirectory, 'compiler')
    const rendererCache = join(sessionDirectory, 'renderer-cache')
    await mkdir(profile, { recursive: true })
    electronExecutable()
    const resources = options.prepared?.resources ?? join(sessionDirectory, 'resources')
    const nativeDirectory = join(sessionDirectory, 'native')
    const nativeBinding =
      options.prepared?.nativeBinding ?? join(nativeDirectory, 'kisaki-native.node')
    let renderer = await renderers.open(rendererCache)

    let child: DevelopmentApplication | undefined
    let current: DevelopmentBuild | undefined
    let generation = 0
    let adoptedDigest: string | undefined
    let runtimeChanged = true
    let rendererChanged = false
    let replacing = false
    let retainOutputs = false

    let phase: 'open' | 'closing' | 'closed' = 'open'
    let terminalFailure = false
    let stopPromise: Promise<'cancelled' | 'stopped'> | undefined
    const shutdownFailures: unknown[] = []

    let workLoop: Promise<void> | undefined
    let waitForChange = false
    let requestVersion = 0
    const pending = new Set<PreparationChange | 'runtime'>(
      options.prepared ? [] : ['resources', 'native'],
    )

    const ready = Promise.withResolvers<void>()
    const closed = Promise.withResolvers<void>()
    void ready.promise.catch(() => undefined)
    void closed.promise.catch(() => undefined)

    function failSession(cause: unknown): void {
      terminalFailure = true
      pending.clear()
      ready.reject(cause)
      shutdownFailures.push(cause)
      options.onState?.('failed', cause)
    }

    async function startCompilers(): Promise<void> {
      compilers = await watchPrograms(
        options.sourceRoot,
        compilerDirectory,
        buildId,
        (state, cause) => {
          if (phase !== 'open' || terminalFailure) {
            return
          }
          if (state === 'ready') {
            enqueue('runtime')
          } else {
            options.onState?.(state, cause)
          }
        },
      )
      runtimeChanged = true
    }

    async function restartApplication(): Promise<void> {
      const owner = compilers
      const batch = owner?.current
      if (phase !== 'open' || !owner || !batch) {
        return
      }
      if (!runtimeChanged && adoptedDigest === batch.digest) {
        options.onState?.('ready')
        return
      }

      const candidate = join(sessionDirectory, `runtime-${++generation}`)

      const discard = () => rm(candidate, { recursive: true, force: true })

      const isCurrent = () =>
        phase === 'open' && owner === compilers && owner.current?.revision === batch.revision

      let prepared = false
      let replacement: RunningRenderer | undefined

      async function releaseUnlaunched() {
        const server = replacement
        if (server) {
          try {
            await server.close()
          } catch (cause) {
            return rethrowAfterCleanup(
              cause,
              discard,
              'Candidate renderer and runtime cleanup failed',
            )
          }
        }
        await discard()
      }

      try {
        await prepareRuntime(compilerDirectory, batch.files, resources, nativeBinding, candidate)
        if (rendererChanged && isCurrent()) {
          replacement = await renderers.open(rendererCache)
        }
        if (isCurrent()) {
          const previous = current?.directory
          if (child) {
            replacing = true
            try {
              if ((await child.stop()) === 'cancelled') {
                throw new Error('Source application restart was cancelled')
              }
            } finally {
              replacing = false
            }
          }
          child = undefined
          current = undefined
          if (previous && !retainOutputs) {
            await rm(previous, { recursive: true, force: true })
          }
          if (replacement && isCurrent()) {
            const previousRenderer = renderer
            renderer = replacement
            replacement = undefined
            rendererChanged = false
            try {
              await previousRenderer.close()
            } catch (cause) {
              options.onState?.('failed', cause)
            }
          }
          signal.throwIfAborted()
          prepared = isCurrent()
        }
      } catch (cause) {
        return rethrowAfterCleanup(
          cause,
          releaseUnlaunched,
          'Runtime preparation and cleanup failed',
        )
      }
      if (!prepared) {
        await releaseUnlaunched()
        return
      }

      try {
        child = await options.launch({
          executable: electronExecutable(),
          args: [join(candidate, 'main/entry.js'), `--renderer-url=${renderer.url}`],
          cwd: appRoot,
          profile,
          buildId,
          signal,
          startupTimeoutMs: options.startupTimeoutMs ?? 30_000,
        })
      } catch (cause) {
        if (cause instanceof UnconfirmedApplicationExit) {
          retainOutputs = true
          throw cause
        }
        return rethrowAfterCleanup(cause, discard, 'Application startup and runtime cleanup failed')
      }
      current = { buildId, directory: candidate, processId: child.pid }
      adoptedDigest = batch.digest
      runtimeChanged = false

      const launched = child
      void launched.exited.then((result) => {
        if (child !== launched || replacing || phase !== 'open') {
          return
        }
        child = undefined
        current = undefined
        if (result.code !== 0) {
          failSession(new Error(`Development application exited (${result.signal ?? result.code})`))
        }
        void session!.stop().catch((cause: unknown) => options.onState?.('failed', cause))
      }, failSession)

      options.signal?.removeEventListener('abort', cancelPreparation)
      ready.resolve()
      options.onState?.('ready')
    }

    async function drain(): Promise<void> {
      while (pending.size && phase === 'open' && !terminalFailure) {
        const selected = new Set(pending)
        pending.clear()
        const started = requestVersion
        options.onState?.('building')
        try {
          if (selected.has('configuration')) {
            await compilers?.close()
            compilers = undefined
            rendererChanged = true
            selected.delete('configuration')
          }
          if (selected.has('resources')) {
            await prepareResources(target, signal, resources)
            runtimeChanged = true
            selected.delete('resources')
          }
          if (selected.has('native')) {
            await buildNative({ target, output: nativeDirectory, signal })
            runtimeChanged = true
            selected.delete('native')
          }
          signal.throwIfAborted()
          if (!compilers) {
            await startCompilers()
          }
          await restartApplication()
        } catch (cause) {
          for (const kind of selected) {
            pending.add(kind)
          }
          if (!isCancellation(cause, signal)) {
            options.onState?.('failed', cause)
            if (phase !== 'open' || signal.aborted) {
              shutdownFailures.push(cause)
            }
          }
          if (requestVersion === started) {
            waitForChange = true
            return
          }
        }
      }
    }

    function enqueue(kind: PreparationChange | 'runtime'): void {
      if (phase === 'closed' || terminalFailure) {
        return
      }
      pending.add(kind)
      requestVersion += 1
      waitForChange = false
      if (phase !== 'open' || workLoop) {
        return
      }
      workLoop = drain().finally(() => {
        workLoop = undefined
        if (pending.size && !waitForChange && phase === 'open' && !terminalFailure) {
          enqueue('runtime')
        }
      })
    }

    function stop(force: boolean): Promise<'cancelled' | 'stopped'> {
      if (phase === 'closed') {
        return closed.promise.then(() => 'stopped')
      }
      if (stopPromise) {
        return force
          ? stopPromise.then(
              (outcome) => (outcome === 'cancelled' ? stop(true) : outcome),
              () => stop(true),
            )
          : stopPromise
      }
      phase = 'closing'
      stopPromise = finish(force).finally(() => {
        stopPromise = undefined
        if (phase === 'open' && pending.size && !terminalFailure) {
          enqueue('runtime')
        }
      })
      return stopPromise
    }

    async function finish(force: boolean): Promise<'cancelled' | 'stopped'> {
      // A restart already negotiating application exit owns that decision until it settles.
      if (replacing) {
        await workLoop
      }
      const application = child
      if (application) {
        debug('Stopping application %s', application.pid)
        try {
          if (force) {
            await application.terminate()
          } else if ((await application.stop()) === 'cancelled') {
            phase = 'open'
            pending.add('runtime')
            return 'cancelled'
          }
        } catch (cause) {
          phase = 'open'
          throw cause
        }
        child = undefined
        current = undefined
      }

      options.signal?.removeEventListener('abort', cancelPreparation)
      controller.abort(new Error('Development session stopped'))
      await workLoop
      const failures = [...shutdownFailures]
      const remaining = child as DevelopmentApplication | undefined
      if (remaining) {
        // A launch can complete as cancellation is delivered; its returned handle owns cleanup.
        try {
          await remaining.terminate()
          child = undefined
          current = undefined
        } catch (cause) {
          failures.push(cause)
          retainOutputs = true
        }
      }
      const results = await closeDevelopmentInputs()
      for (const result of results) {
        if (result.status === 'rejected') {
          failures.push(result.reason)
        }
      }
      if (!retainOutputs && results.every((result) => result.status === 'fulfilled')) {
        try {
          await rm(sessionDirectory, { recursive: true, force: true })
        } catch (cause) {
          failures.push(cause)
        }
      } else {
        failures.push(
          new Error(
            `Development outputs retained because closure is unconfirmed: ${sessionDirectory}`,
          ),
        )
      }

      phase = 'closed'
      ready.reject(signal.reason)
      if (failures.length) {
        const cause =
          failures.length === 1
            ? failures[0]
            : new AggregateError(failures, 'Development session shutdown failed')
        closed.reject(cause)
        throw cause
      }
      closed.resolve()
      options.onState?.('stopped')
      return 'stopped'
    }

    session = {
      ready: ready.promise,
      closed: closed.promise,
      get rendererUrl() {
        return renderer.url
      },
      get current() {
        return current
      },
      stop() {
        return stop(false)
      },
      async terminate() {
        await stop(true)
      },
    }

    inputs = await startInputWatcher(options.sourceRoot, {
      watchAssets: !options.prepared,
      signal,
      onChange: enqueue,
      onError: failSession,
    })
    enqueue('runtime')
    if (signal.aborted) {
      await session.stop()
    }
    return session
  } catch (cause) {
    options.signal?.removeEventListener('abort', cancelPreparation)
    const failures: unknown[] = [cause]
    const results = await closeDevelopmentInputs()
    for (const result of results) {
      if (result.status === 'rejected') {
        failures.push(result.reason)
      }
    }
    if (failures.length === 1 && directory) {
      try {
        await rm(directory, { recursive: true, force: true })
      } catch (failure) {
        failures.push(failure)
      }
    }
    throw failures.length === 1
      ? cause
      : new AggregateError(failures, 'Development startup and cleanup failed')
  }
}
