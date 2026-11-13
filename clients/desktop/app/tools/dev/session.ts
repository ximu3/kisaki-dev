/** @fileoverview Coordinates native compilers, preparation workflows and one development application. */

import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { debuglog } from 'node:util'
import { runPnpm } from '@kisaki3/tooling/process'
import { isCancellation, rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { appRoot, repositoryRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { prepareResources } from '../resources/prepare'
import { buildNative } from '../native/build'
import { startRenderer } from './renderer'
import { startInputWatcher } from './inputs'
import type { PreparationChange } from './inputs'
import { electronExecutable } from './electron-executable'
import { desktopDependencies } from './dependencies'
import { prepareGeneration } from './generation'
import { watchPrograms } from './programs'
import type { ProgramWatch } from './programs'

/** Opt-in diagnostics for development generation adoption and resource shutdown. */
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
 * Watching session owning a renderer, input watchers and the application processes started from completed compiler output.
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
 * Starts a source development session with Vite-owned program compilation and renderer HMR.
 *
 * Preparation errors remain observable and can recover after another input change. The returned
 * session owns every compiler, server and process until stop or terminate finishes.
 */
export async function startDevelopmentSession(
  options: DevelopmentOptions,
): Promise<DevelopmentSession> {
  if (!isAbsolute(options.sourceRoot)) {
    throw new Error('Development source root must be an absolute path')
  }
  const profile = options.profile ?? join(appRoot, '.local', 'development')
  if (!isAbsolute(profile)) {
    throw new Error('Development profile must be an absolute path')
  }
  options.signal?.throwIfAborted()

  const target = hostTarget()
  const buildId = randomUUID()
  const controller = new AbortController()
  const signal = controller.signal
  let session: DevelopmentSession | undefined

  /** Forwards cancellation until the first application is ready. */
  const cancelPreparation = () => {
    controller.abort(options.signal?.reason)
    void session?.stop().catch((cause: unknown) => options.onState?.('failed', cause))
  }
  options.signal?.addEventListener('abort', cancelPreparation, { once: true })

  let directory: string | undefined
  let renderer: Awaited<ReturnType<typeof startRenderer>> | undefined
  let inputs: Awaited<ReturnType<typeof startInputWatcher>> | undefined
  let compilers: ProgramWatch | undefined

  try {
    const parent = join(appRoot, 'out/development', target)
    await mkdir(parent, { recursive: true })
    const sessionDirectory = await mkdtemp(join(parent, 'session-'))
    directory = sessionDirectory
    const compilerDirectory = join(sessionDirectory, 'compiler')
    await mkdir(profile, { recursive: true })
    electronExecutable()
    let members = await desktopDependencies(signal)
    renderer = await startRenderer(options.sourceRoot, members, buildId)
    let rendererAddress = renderer.resolvedUrls!.local[0]!

    let child: DevelopmentApplication | undefined
    let current: DevelopmentBuild | undefined
    let generation = 0
    let adoptedDigest: string | undefined
    let runtimeChanged = true
    let replacing = false
    let retainOutputs = false

    let stopping = false
    let stopped = false
    let terminalFailure = false
    let stopPromise: Promise<'cancelled' | 'stopped'> | undefined
    const shutdownFailures: unknown[] = []

    let workLoop: Promise<void> | undefined
    let waitForChange = false
    let requestVersion = 0
    const pending = new Set<PreparationChange | 'runtime'>(['packages', 'resources', 'native'])

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
    void ready.catch(() => undefined)
    void closed.catch(() => undefined)

    /** Reports a nonrecoverable watcher failure while preserving ownership of active resources. */
    function failSession(cause: unknown): void {
      terminalFailure = true
      pending.clear()
      rejectReady(cause)
      shutdownFailures.push(cause)
      options.onState?.('failed', cause)
    }

    /** Rebuilds compiler watchers after the current configuration has been prepared. */
    async function startCompilers(): Promise<void> {
      compilers = await watchPrograms(
        options.sourceRoot,
        compilerDirectory,
        buildId,
        (state, cause) => {
          if (stopping || stopped || terminalFailure) {
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

    /** Launches one completed compiler batch and releases the previous runtime after its readers exit. */
    async function restartApplication(): Promise<void> {
      const owner = compilers
      const batch = owner?.current
      if (stopping || !owner || !batch) {
        return
      }
      if (!runtimeChanged && adoptedDigest === batch.digest) {
        options.onState?.('ready')
        return
      }

      const candidate = join(sessionDirectory, `runtime-${++generation}`)

      /** Releases an unused runtime before any process takes ownership. */
      const discard = () => rm(candidate, { recursive: true, force: true })

      /** Checks the compiler completion token before handing its copied output to a process. */
      const isCurrent = () =>
        !stopping && owner === compilers && owner.current?.revision === batch.revision

      let prepared = false

      try {
        await prepareGeneration(compilerDirectory, batch.files, target, candidate)
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
          signal.throwIfAborted()
          prepared = isCurrent()
        }
      } catch (cause) {
        return rethrowAfterCleanup(cause, discard, 'Runtime preparation and cleanup failed')
      }
      if (!prepared) {
        await discard()
        return
      }

      try {
        child = await options.launch({
          executable: electronExecutable(),
          args: [join(candidate, 'main/entry.js'), `--renderer-url=${rendererAddress}`],
          cwd: appRoot,
          profile,
          buildId,
          signal,
          startupTimeoutMs: 30_000,
        })
      } catch (cause) {
        retainOutputs = true
        throw cause
      }
      current = { buildId, directory: candidate, processId: child.pid }
      adoptedDigest = batch.digest
      runtimeChanged = false

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
        void session!.stop().catch((cause: unknown) => options.onState?.('failed', cause))
      }, failSession)

      options.signal?.removeEventListener('abort', cancelPreparation)
      resolveReady()
      options.onState?.('ready')
    }

    /** Runs selected preparation work serially; compilers independently observe their module inputs. */
    async function drain(): Promise<void> {
      while (pending.size && !stopping && !terminalFailure) {
        const selected = new Set(pending)
        pending.clear()
        const started = requestVersion
        options.onState?.('building')
        try {
          if (selected.has('configuration')) {
            const nextMembers = await desktopDependencies(signal)
            const nextInputs = await startInputWatcher(options.sourceRoot, nextMembers, {
              signal,
              onChange: enqueue,
              onError: failSession,
            })
            try {
              await inputs!.close()
            } catch (cause) {
              await rethrowAfterCleanup(
                cause,
                () => nextInputs.close(),
                'Input watch replacement and cleanup failed',
              )
            }
            inputs = nextInputs
            members = nextMembers
            await compilers?.close()
            compilers = undefined
            await renderer?.close()
            renderer = undefined
            renderer = await startRenderer(options.sourceRoot, members, buildId)
            rendererAddress = renderer.resolvedUrls!.local[0]!
            selected.add('packages')
            selected.delete('configuration')
          }
          if (selected.has('packages')) {
            await runPnpm(['exec', 'turbo', 'run', 'build', '--filter=@kisaki3/desktop^...'], {
              cwd: repositoryRoot,
              signal,
            })
            selected.delete('packages')
          }
          if (selected.has('resources')) {
            await prepareResources(target, signal)
            runtimeChanged = true
            selected.delete('resources')
          }
          if (selected.has('native')) {
            await buildNative(target, false, signal)
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
            if (stopping || signal.aborted) {
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

    /** Coalesces real input or compiler completion events into the owned preparation loop. */
    function enqueue(kind: PreparationChange | 'runtime'): void {
      if (stopped || terminalFailure) {
        return
      }
      pending.add(kind)
      requestVersion += 1
      waitForChange = false
      if (stopping || workLoop) {
        return
      }
      workLoop = drain().finally(() => {
        workLoop = undefined
        if (pending.size && !waitForChange && !stopping && !terminalFailure) {
          enqueue('runtime')
        }
      })
    }

    session = {
      ready: ready,
      closed: closed,
      /** Reads the renderer's current address, including configuration restarts. */
      get rendererUrl() {
        return renderer?.resolvedUrls?.local[0] ?? rendererAddress
      },
      /** Reads the currently owned application and runtime directory. */
      get current() {
        return current
      },
      /** Stops preparation, confirms application exit, and closes every remaining resource owner. */
      stop() {
        if (stopped) {
          return Promise.resolve('stopped')
        }
        if (stopPromise) {
          return stopPromise
        }
        stopping = true
        if (!current) {
          controller.abort(new Error('Development startup cancelled'))
        }
        stopPromise = (async () => {
          await workLoop
          debug('Stopping application %s', child?.pid ?? 'not started')
          if (child && (await child.stop()) === 'cancelled') {
            pending.add('runtime')
            return 'cancelled'
          }
          child = undefined
          current = undefined
          options.signal?.removeEventListener('abort', cancelPreparation)
          controller.abort(new Error('Development session stopping'))

          const failures = [...shutdownFailures]
          shutdownFailures.length = 0
          let ownersClosed = true
          for (const resource of [inputs, compilers, renderer]) {
            try {
              await resource?.close()
            } catch (cause) {
              failures.push(cause)
              ownersClosed = false
            }
          }
          if (ownersClosed && !retainOutputs) {
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
            const cause = new AggregateError(failures, 'Development session shutdown failed')
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
            if (pending.size) {
              enqueue('runtime')
            }
          }
        })
        return stopPromise
      },
      /** Confirms forced termination before completing the same session teardown. */
      async terminate() {
        stopping = true
        await child?.terminate()
        await session!.stop()
      },
    }

    inputs = await startInputWatcher(options.sourceRoot, members, {
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
    for (const resource of [inputs, compilers, renderer]) {
      try {
        await resource?.close()
      } catch (failure) {
        failures.push(failure)
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
