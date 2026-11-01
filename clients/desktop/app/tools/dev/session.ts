/**
 * @fileoverview Owns one development session's build generations, input watchers, renderer
 * server and application lifecycle.
 */

import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { runPnpm } from '@kisaki3/tooling/process'
import { appRoot, repositoryRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { startRenderer } from './renderer'
import { startInputWatcher } from './inputs'
import { buildInputIdentity } from '../build/identity'
import { prepareResources } from '../resources/prepare'
import { electronExecutable } from './electron-executable'
import { captureDependencies, desktopDependencies } from './dependencies'
import { buildGeneration, programInputsChanged } from './generation'
import type { GenerationOutput } from './generation'
import type { DependencySnapshot } from './dependencies'

/** Process lifecycle supplied by the launch owner; readiness has completed when launch resolves. */
export interface DevelopmentApplication {
  pid: number
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>
  stop(): Promise<'cancelled' | 'exited'>
  terminate(): Promise<void>
}

/** Inputs for one owned Electron process and its startup readiness deadline. */
export interface DevelopmentLaunchOptions {
  executable: string
  args: string[]
  cwd: string
  profile: string
  buildId: string
  signal: AbortSignal
  startupTimeoutMs: number
}

/** The built runtime and Electron process currently owned by a development session. */
export interface DevelopmentBuild {
  buildId: string
  directory: string
  processId: number
}

/** A development session owns its processes, watchers and private output directories until closed. */
export interface DevelopmentSession {
  /** First ready application; compilation failures can recover, while stopped startup or resource failure rejects. */
  readonly ready: Promise<void>
  /** Settles after teardown; cleanup errors reject, and outputs with unconfirmed readers remain on disk. */
  readonly closed: Promise<void>
  readonly rendererUrl: string
  /** Current running generation; absent before launch, during replacement and after process exit. */
  readonly current: DevelopmentBuild | undefined
  /** Request normal application exit, then close tools and outputs; cancellation keeps the session usable. */
  stop(): Promise<'cancelled' | 'stopped'>
  /** Explicitly end this session's application before closing its tools and outputs. */
  terminate(): Promise<void>
}

/** Caller-owned profiles survive stop; signal cancels startup only, before the first ready application. */
export interface DevelopmentOptions {
  /** Absolute root containing the program source and Vite configurations. */
  sourceRoot: string
  /** Launch a ready process whose lifetime remains owned by this session. */
  launch: (options: DevelopmentLaunchOptions) => Promise<DevelopmentApplication>
  profile?: string
  signal?: AbortSignal
  onState?: (state: 'building' | 'failed' | 'ready' | 'stopped', error?: unknown) => void
}

/** Return a watching session before its first build completes; await ready for the first usable application. */
export async function startDevelopmentSession(
  options: DevelopmentOptions,
): Promise<DevelopmentSession> {
  if (!isAbsolute(options.sourceRoot)) {
    throw new Error('Development source root must be an absolute path')
  }
  const target = hostTarget()
  const profile = options.profile ?? join(appRoot, '.local', 'development')
  if (!isAbsolute(profile)) {
    throw new Error('Development profile must be an absolute path')
  }

  options.signal?.throwIfAborted()

  const controller = new AbortController()
  const cancelPreparation = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancelPreparation, { once: true })
  const signal = controller.signal

  let directory: string | undefined
  let rendererToClose: Awaited<ReturnType<typeof startRenderer>> | undefined
  let inputsToClose: Awaited<ReturnType<typeof startInputWatcher>> | undefined
  let child: DevelopmentApplication | undefined

  try {
    const parent = join(appRoot, 'out', 'development', target)
    await mkdir(parent, { recursive: true })
    const sessionDirectory = await mkdtemp(join(parent, 'session-'))
    directory = sessionDirectory

    await mkdir(profile, { recursive: true })

    const members = await desktopDependencies(signal)
    electronExecutable()
    await prepareResources(target, signal)

    const tasks = ['run', 'build', '--filter=@kisaki3/desktop^...']
    const snapshotDirectory = join(sessionDirectory, 'dependencies')
    const renderer = await startRenderer(options.sourceRoot, members, snapshotDirectory)
    rendererToClose = renderer
    signal.throwIfAborted()

    let current: DevelopmentBuild | undefined
    let stopping = false
    let replacing = false
    let stopped = false
    let resourceFailed = false
    // An abnormal main exit cannot confirm that every runtime reader has stopped.
    let retainOutputs = false
    let stopPromise: Promise<'cancelled' | 'stopped'> | undefined

    let buildPending = false
    let buildLoop: Promise<void> | undefined
    let generation = 0
    let forceRuntimeBuild = true
    let programInputs = new Map<string, string>()

    let resolveReady!: () => void
    let rejectReady!: (cause: unknown) => void
    let resolveClosed!: () => void
    let rejectClosed!: (cause: unknown) => void
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    const closed = new Promise<void>((resolve, reject) => {
      resolveClosed = resolve
      rejectClosed = reject
    })

    // Stop can precede the caller's first await of these lifecycle promises.
    void ready.catch(() => undefined)
    void closed.catch(() => undefined)

    /** Keep the current application owned while preventing further adoption after a resource fails. */
    function failSession(cause: unknown): void {
      resourceFailed = true
      buildPending = false
      rejectReady(cause)
      options.onState?.('failed', cause)
    }

    /** Build dependencies, capture their complete exports and compile the next private generation. */
    async function rebuild(): Promise<void> {
      options.onState?.('building')
      generation += 1
      const candidate = join(sessionDirectory, `generation-${generation}`)
      let launching = false
      let dependencies: DependencySnapshot | undefined
      let failure: unknown

      /** The renderer takes ownership even if refresh or prior-copy cleanup fails. */
      async function adoptDependencies(): Promise<void> {
        const next = dependencies!
        dependencies = undefined
        await renderer.adopt(next)
      }

      try {
        await runPnpm(['exec', 'turbo', ...tasks], { cwd: repositoryRoot, signal })

        dependencies = await captureDependencies(members, snapshotDirectory)

        const forced = forceRuntimeBuild
        forceRuntimeBuild = false
        let runtime: GenerationOutput | undefined
        if (!current || forced || (await programInputsChanged(programInputs))) {
          runtime = await buildGeneration(options.sourceRoot, target, candidate, signal)
          if (runtime.buildId !== (await buildInputIdentity({ signal }))) {
            buildPending = !stopping && !resourceFailed
            return
          }
        }

        if (stopping || resourceFailed) {
          return
        }

        if (!runtime) {
          await adoptDependencies()
          if (!resourceFailed) {
            options.onState?.('ready')
          }
          return
        }

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

        signal.throwIfAborted()
        if (stopping || resourceFailed) {
          return
        }

        await adoptDependencies()
        signal.throwIfAborted()
        if (stopping || resourceFailed) {
          return
        }

        launching = true
        child = await options.launch({
          executable: electronExecutable(),
          args: [join(candidate, 'main', 'entry.js'), `--renderer-url=${renderer.url}`],
          cwd: appRoot,
          profile,
          buildId: runtime.buildId,
          signal,
          startupTimeoutMs: 30_000,
        })
        current = { buildId: runtime.buildId, directory: candidate, processId: child.pid }

        const launched = child
        void launched.exited.then((result) => {
          if (result.code !== 0) {
            retainOutputs = true
          }
          if (child !== launched || replacing || stopping) {
            return
          }

          child = undefined
          current = undefined
          if (result.code !== 0) {
            options.onState?.('failed', new Error('Development application exited unsuccessfully'))
          }

          void session.stop().catch((cause: unknown) => options.onState?.('failed', cause))
        })

        programInputs = runtime.inputs
        if (previous && !retainOutputs) {
          await rm(previous, { recursive: true, force: true })
        }
        if (resourceFailed) {
          return
        }

        options.signal?.removeEventListener('abort', cancelPreparation)
        options.onState?.('ready')
        resolveReady()
      } catch (cause) {
        forceRuntimeBuild = true
        failure = cause
        if (launching) {
          retainOutputs = true
        }
      } finally {
        const unused = []
        if (!launching && current?.directory !== candidate) {
          unused.push(candidate)
        }
        if (dependencies) {
          unused.push(dependencies.directory)
        }
        const cleaned = await Promise.allSettled(
          unused.map((path) => rm(path, { recursive: true, force: true })),
        )
        const errors: unknown[] = []
        for (const result of cleaned) {
          if (result.status === 'rejected') {
            errors.push(result.reason)
          }
        }
        if (failure && !signal.aborted) {
          errors.unshift(failure)
        }
        if (errors.length) {
          options.onState?.(
            'failed',
            errors.length === 1
              ? errors[0]
              : new AggregateError(errors, 'Development build and cleanup failed'),
          )
        }
      }
    }

    /** Coalesce changes into serial rebuilds owned by this development session. */
    function enqueue(force = false): void {
      if (stopped || resourceFailed) {
        return
      }

      forceRuntimeBuild ||= force
      buildPending = true
      if (stopping) {
        return
      }

      buildLoop ??= (async () => {
        while (buildPending && !stopping && !resourceFailed) {
          buildPending = false
          await rebuild()
        }
      })().finally(() => {
        buildLoop = undefined
      })
    }

    const cancel = () => {
      void session.stop().catch((cause: unknown) => {
        options.onState?.('failed', cause)
      })
    }
    const session: DevelopmentSession = {
      ready,
      closed,

      get rendererUrl() {
        return renderer.url
      },

      get current() {
        return current
      },

      stop() {
        if (stopped) {
          return Promise.resolve('stopped')
        }
        if (stopPromise) {
          return stopPromise
        }

        stopping = true
        signal.removeEventListener('abort', cancel)
        if (!current) {
          controller.abort(new Error('Development startup cancelled'))
        }

        stopPromise = (async () => {
          await buildLoop
          if (child && (await child.stop()) === 'cancelled') {
            return 'cancelled'
          }

          signal.removeEventListener('abort', cancel)
          options.signal?.removeEventListener('abort', cancelPreparation)
          controller.abort(new Error('Development session stopping'))
          const failures: unknown[] = []
          child = undefined
          current = undefined
          let rendererClosed = false

          try {
            await inputs.close()
          } catch (cause) {
            failures.push(cause)
          }

          try {
            await renderer.close()
            rendererClosed = true
          } catch (cause) {
            failures.push(cause)
          }

          if (rendererClosed && !retainOutputs) {
            try {
              await rm(sessionDirectory, { recursive: true, force: true })
            } catch (cause) {
              failures.push(cause)
            }
          }

          if (retainOutputs) {
            options.onState?.(
              'failed',
              new Error(
                `Development outputs retained because reader shutdown is unconfirmed: ${sessionDirectory}`,
              ),
            )
          }

          rejectReady(new Error('Development session stopped before readiness'))
          if (failures.length) {
            const cause = new AggregateError(failures, 'Development session cleanup failed')
            rejectClosed(cause)
            throw cause
          }

          stopped = true
          resolveClosed()
          options.onState?.('stopped')
          return 'stopped'
        })().finally(() => {
          stopPromise = undefined
          if (!stopped && !signal.aborted) {
            stopping = false
            if (buildPending) {
              enqueue()
            }
          }
        })

        return stopPromise
      },

      async terminate() {
        stopping = true
        await child?.terminate()
        await session.stop()
      },
    }

    const inputs = await startInputWatcher(options.sourceRoot, members, {
      signal,
      onChange: (change) => enqueue(change === 'runtime'),
      onError: failSession,
    })
    inputsToClose = inputs
    signal.addEventListener('abort', cancel, { once: true })
    enqueue()
    if (signal.aborted) {
      cancel()
    }

    return session
  } catch (cause) {
    options.signal?.removeEventListener('abort', cancelPreparation)
    const failures: unknown[] = [cause]

    try {
      await child?.terminate()
    } catch (failure) {
      failures.push(failure)
    }

    for (const resource of [inputsToClose, rendererToClose]) {
      try {
        await resource?.close()
      } catch (failure) {
        failures.push(failure)
      }
    }

    if (failures.length > 1) {
      throw new AggregateError(failures, 'Development startup and cleanup failed', { cause })
    }

    if (directory) {
      await rm(directory, { recursive: true, force: true })
    }

    throw cause
  }
}
