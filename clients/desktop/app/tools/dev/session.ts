/** @fileoverview Coordinates native compilers, preparation workflows and one development application. */

import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { debuglog } from 'node:util'
import { isCancellation, rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { appRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { prepareResources } from '../resources/prepare'
import { buildNative } from '../native/build'
import { startRenderer } from './renderer'
import { startInputWatcher } from './inputs'
import type { PreparationChange } from './inputs'
import { electronExecutable } from './electron-executable'
import { prepareRuntime } from './prepare-runtime'
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

/** Startup failed and its process owner could not confirm closure of the runtime's readers. */
export class UnconfirmedApplicationExit extends AggregateError {}

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
   * Launches the expected build and resolves with a ready application. A failed start closes its
   * readers before rejection. UnconfirmedApplicationExit means those readers may remain live.
   */
  launch: (options: DevelopmentLaunchOptions) => Promise<DevelopmentApplication>
  /** Persistent absolute profile directory; defaults to the desktop app's .local/development. */
  profile?: string
  /** Read-only resource directory and native file already prepared for this host. */
  prepared?: { resources: string; nativeBinding: string }
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
    const resources = options.prepared?.resources ?? join(sessionDirectory, 'resources')
    const nativeDirectory = join(sessionDirectory, 'native')
    const nativeBinding =
      options.prepared?.nativeBinding ?? join(nativeDirectory, 'kisaki-native.node')
    renderer = await startRenderer(options.sourceRoot, buildId)
    let rendererAddress = renderer.resolvedUrls!.local[0]!

    let child: DevelopmentApplication | undefined
    let current: DevelopmentBuild | undefined
    let generation = 0
    let adoptedDigest: string | undefined
    let runtimeChanged = true
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

    /** Reports a nonrecoverable watcher failure while preserving ownership of active resources. */
    function failSession(cause: unknown): void {
      terminalFailure = true
      pending.clear()
      ready.reject(cause)
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

    /** Launches one completed compiler batch and releases the previous runtime after its readers exit. */
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

      /** Releases an unused runtime before any process takes ownership. */
      const discard = () => rm(candidate, { recursive: true, force: true })

      /** Checks the compiler completion token before handing its copied output to a process. */
      const isCurrent = () =>
        phase === 'open' && owner === compilers && owner.current?.revision === batch.revision

      let prepared = false

      try {
        await prepareRuntime(compilerDirectory, batch.files, resources, nativeBinding, candidate)
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

    /** Runs selected preparation work serially; compilers independently observe their module inputs. */
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
            await renderer?.close()
            renderer = undefined
            renderer = await startRenderer(options.sourceRoot, buildId)
            rendererAddress = renderer.resolvedUrls!.local[0]!
            selected.delete('configuration')
          }
          if (selected.has('resources')) {
            await prepareResources(target, signal, resources)
            runtimeChanged = true
            selected.delete('resources')
          }
          if (selected.has('native')) {
            await buildNative(target, false, signal, nativeDirectory)
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

    /** Coalesces real input or compiler completion events into the owned preparation loop. */
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

    /** Coordinates one application decision, then cancels work and releases each tool once. */
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

    /** Preserves a refused or failed quit; an accepted stop has one terminal teardown result. */
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
      const results = await Promise.allSettled([
        inputs?.close(),
        compilers?.close(),
        renderer?.close(),
      ])
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
      /** Reads the address of the live renderer server. */
      get rendererUrl() {
        return renderer?.resolvedUrls?.local[0] ?? rendererAddress
      },
      /** Reads the adopted process and its runtime directory. */
      get current() {
        return current
      },
      /** Requests normal, cancellable application exit. */
      stop() {
        return stop(false)
      },
      /** Forces the owned application to exit before teardown. */
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
