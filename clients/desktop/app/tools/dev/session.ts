/**
 * @fileoverview Owns one development session's build generations, input watchers, renderer
 * server and application lifecycle.
 */

import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { debuglog } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'
import { isCancellation, rethrowAfterCleanup } from '@kisaki3/tooling/errors'
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

const debug = debuglog('kisaki:development')

/** Ready application process whose lifetime is supplied by the launch owner. */
export interface DevelopmentApplication {
  pid: number
  /** Completes after the launched process and its output streams close. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>

  /** Requests normal exit and reports whether the application exited or declined the request. */
  stop(): Promise<'cancelled' | 'exited'>

  /** Forces the owned process to end and waits for its exit. */
  terminate(): Promise<void>
}

/**
 * Launch inputs for one owned Electron process, including its profile, build identity and readiness
 * budget.
 */
export interface DevelopmentLaunchOptions {
  executable: string
  args: string[]
  cwd: string

  profile: string
  buildId: string

  /** Cancels startup; after readiness the returned application owns process control. */
  signal: AbortSignal
  /** Budget in milliseconds for reaching the expected build's ready state. */
  startupTimeoutMs: number
}

/** Identity, output directory and process ID of the session's adopted application generation. */
export interface DevelopmentBuild {
  buildId: string
  directory: string
  processId: number
}

/**
 * Watching session owning a renderer, input watchers and successive application generations.
 *
 * The caller closes this handle even if readiness fails. Persistent profiles remain caller-owned.
 */
export interface DevelopmentSession {
  /** Resolves on the first ready application; recoverable build failures leave it pending. */
  readonly ready: Promise<void>
  /** Settles after tool teardown; failures reject and unconfirmed-reader outputs remain on disk. */
  readonly closed: Promise<void>
  /** Current renderer address, read from the live server handle. */
  readonly rendererUrl: string
  /** Adopted application generation; absent while the session owns no completed launch. */
  readonly current: DevelopmentBuild | undefined

  /**
   * Requests normal application exit, then tears down session tools and outputs.
   *
   * Concurrent requests share one operation. Cancellation keeps the session usable; confirmed
   * shutdown resolves as stopped. Teardown failures reject, and outputs with unconfirmed readers
   * are retained.
   */
  stop(): Promise<'cancelled' | 'stopped'>

  /**
   * Forces application exit before performing session cleanup.
   *
   * Cleanup starts after termination is confirmed; a termination failure leaves the session's
   * resources owned.
   */
  terminate(): Promise<void>
}

/** Source, profile, launch capability and state reporting for a development session. */
export interface DevelopmentOptions {
  /** Absolute root containing the program source and Vite configurations. */
  sourceRoot: string
  /**
   * Launches the expected build and resolves with an application that has completed startup
   * readiness.
   */
  launch: (options: DevelopmentLaunchOptions) => Promise<DevelopmentApplication>
  /** Persistent absolute profile directory; defaults to the desktop app's .local/development. */
  profile?: string
  /** Cancels preparation until the first ready application; later lifetime uses the session handle. */
  signal?: AbortSignal
  /**
   * Reports build and session state; recoverable rebuild failures can leave the current application
   * usable.
   */
  onState?: (state: 'building' | 'failed' | 'ready' | 'stopped', error?: unknown) => void
}

/**
 * Starts a watching development session and returns its lifecycle handle.
 *
 * Initial tool and resource preparation completes before return. The first application build runs
 * asynchronously; ready identifies its usable launch. The caller uses stop or terminate to finish
 * ownership of the returned session.
 */
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
  /** Forwards caller cancellation while the first application is still being prepared. */
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
    let shutdownFailures: unknown[] = []
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

    /**
     * Stops future adoption after a session-level resource failure while retaining the current
     * application's ownership.
     */
    function failSession(cause: unknown): void {
      resourceFailed = true
      buildPending = false
      rejectReady(cause)
      options.onState?.('failed', cause)
    }

    /**
     * Prepares current dependencies and, when needed, a new application generation.
     *
     * Adopts complete candidates, waits for normal exit before replacement, and releases unused
     * candidates. Reports recoverable failures while retaining any still-owned application and
     * unconfirmed-reader outputs.
     */
    async function rebuild(): Promise<void> {
      options.onState?.('building')
      generation += 1
      const candidate = join(sessionDirectory, `generation-${generation}`)
      let launching = false
      let dependencies: DependencySnapshot | undefined
      let failure: unknown

      /**
       * Transfers the prepared dependency copy to the renderer, including refresh and cleanup
       * failure paths.
       */
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
        }, failSession)

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
        if (failure && !isCancellation(failure, signal)) {
          errors.unshift(failure)
        }

        if (errors.length) {
          if (stopping || signal.aborted) {
            shutdownFailures.push(...errors)
          }
          options.onState?.(
            'failed',
            errors.length === 1
              ? errors[0]
              : new AggregateError(errors, 'Development build and cleanup failed'),
          )
        }
      }
    }

    /**
     * Coalesces changes into serial rebuilds and preserves pending work while a normal stop is
     * undecided.
     */
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

    /**
     * Requests session shutdown after internal startup cancellation and reports a shutdown failure.
     */
    const cancel = () => {
      void session.stop().catch((cause: unknown) => {
        options.onState?.('failed', cause)
      })
    }
    const session: DevelopmentSession = {
      ready,
      closed,

      /** Reads the renderer's current listening address. */
      get rendererUrl() {
        return renderer.url
      },

      /** Returns the session's currently adopted application generation. */
      get current() {
        return current
      },

      /**
       * Implements {@link DevelopmentSession.stop}, coordinating active builds, application exit
       * and tool cleanup.
       */
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
          debug('Waiting for the active build before stopping')
          await buildLoop

          debug('Stopping application %s', child?.pid ?? 'not started')
          if (child && (await child.stop()) === 'cancelled') {
            debug('Application declined the stop request')
            return 'cancelled'
          }

          signal.removeEventListener('abort', cancel)
          options.signal?.removeEventListener('abort', cancelPreparation)
          controller.abort(new Error('Development session stopping'))

          const failures = shutdownFailures
          shutdownFailures = []
          child = undefined
          current = undefined
          let rendererClosed = false

          try {
            debug('Closing input watchers')
            await inputs.close()
          } catch (cause) {
            failures.push(cause)
          }

          try {
            debug('Closing the renderer server')
            await renderer.close()
            rendererClosed = true
          } catch (cause) {
            failures.push(cause)
          }

          if (rendererClosed && !retainOutputs) {
            try {
              debug('Removing session directory %s', sessionDirectory)
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
            const cause = new AggregateError(failures, 'Development session shutdown failed')
            rejectClosed(cause)
            throw cause
          }

          stopped = true
          debug('Development session stopped')
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

      /**
       * Implements {@link DevelopmentSession.terminate}, awaiting forced process exit before normal
       * teardown.
       */
      async terminate() {
        stopping = true
        debug('Terminating application %s', child?.pid ?? 'not started')
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
      const remainingDirectory = directory
      return rethrowAfterCleanup(
        cause,
        () => rm(remainingDirectory, { recursive: true, force: true }),
        'Development startup and directory cleanup failed',
      )
    }

    throw cause
  }
}
