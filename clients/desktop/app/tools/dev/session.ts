import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { runPnpm } from '@kisaki3/tooling/process'
import type { DevelopmentApplication } from '@kisaki3/extension-cli/extension'
import { appRoot, repositoryRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { startRenderer } from './renderer'
import { sourceIdentity } from '../build/identity'
import { prepareResources } from '../resources/prepare'
import { electronExecutable } from './electron-executable'
import { captureDependencies, desktopDependencies } from './dependencies'
import { buildGeneration, programInputsChanged } from './generation'
import type { GenerationOutput } from './generation'
import type { DependencySnapshot } from './dependencies'

/** The built runtime and Electron process currently owned by a development session. */
export interface DevelopmentBuild {
  buildId: string
  directory: string
  processId: number
}

/** A development session owns its processes, watchers and private output directories until closed. */
export interface DevelopmentSession {
  readonly ready: Promise<void>
  readonly closed: Promise<void>
  readonly rendererUrl: string
  readonly current: DevelopmentBuild | undefined
  /** Request normal application exit, then close tools and outputs; cancellation keeps the session usable. */
  stop(): Promise<'cancelled' | 'stopped'>
  /** Explicitly end this session's application before closing its tools and outputs. */
  terminate(): Promise<void>
}

/** Caller-owned profiles survive stop; signal cancels startup only, before the first ready application. */
export interface DevelopmentOptions {
  profile?: string
  signal?: AbortSignal
  onState?: (state: 'building' | 'failed' | 'ready' | 'stopped', error?: unknown) => void
}

/** Start a development session and publish only complete private generations to its readers. */
export async function startDevelopmentSession(
  options: DevelopmentOptions = {},
): Promise<DevelopmentSession> {
  const target = hostTarget()
  const profile = options.profile ?? join(appRoot, '.local', 'development')
  if (!isAbsolute(profile)) throw new Error('Development profile must be an absolute path')

  options.signal?.throwIfAborted()
  const controller = new AbortController()
  const cancelPreparation = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancelPreparation, { once: true })
  const signal = controller.signal
  let directory: string | undefined
  let rendererToClose: Awaited<ReturnType<typeof startRenderer>> | undefined
  let child: DevelopmentApplication | undefined
  const snapshots = new Map<string, DependencySnapshot>()

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
    const renderer = await startRenderer(members, snapshotDirectory)
    rendererToClose = renderer
    signal.throwIfAborted()

    try {
      await runPnpm(['exec', 'turbo', ...tasks], { cwd: repositoryRoot, signal })
      const initialDependencies = await captureDependencies(
        members,
        snapshotDirectory,
        snapshots,
        renderer.resolveDependency,
      )
      await renderer.adopt(initialDependencies)
    } catch (cause) {
      if (signal.aborted) throw cause
      options.onState?.('failed', cause)
    }

    signal.throwIfAborted()

    let current: DevelopmentBuild | undefined
    let stopping = false
    let replacing = false
    let stopped = false
    let connectionFailed = false
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

    /** Build dependencies, capture their complete exports and compile the next private generation. */
    async function rebuild(): Promise<void> {
      options.onState?.('building')
      const candidate = join(sessionDirectory, `generation-${++generation}`)
      let launching = false
      try {
        await runPnpm(['exec', 'turbo', ...tasks], { cwd: repositoryRoot, signal })
        const dependencies = await captureDependencies(
          members,
          snapshotDirectory,
          snapshots,
          renderer.resolveDependency,
        )
        const forced = forceRuntimeBuild
        forceRuntimeBuild = false
        let runtime: GenerationOutput | undefined
        if (!current || forced || (await programInputsChanged(programInputs))) {
          runtime = await buildGeneration(target, candidate, signal)
          if (runtime.buildId !== (await sourceIdentity())) {
            buildPending = !stopping
            await rm(candidate, { recursive: true, force: true })
            return
          }
        }
        if (stopping || connectionFailed) {
          await rm(candidate, { recursive: true, force: true })
          return
        }
        if (!runtime) {
          await renderer.adopt(dependencies)
          options.onState?.('ready')
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
        await renderer.adopt(dependencies)
        signal.throwIfAborted()
        const { launchDevelopmentApplication } = await import('@kisaki3/extension-cli/extension')
        launching = true
        child = await launchDevelopmentApplication({
          executable: electronExecutable(),
          args: [join(candidate, 'main', 'entry.js'), `--renderer-url=${renderer.url}`],
          cwd: appRoot,
          profile,
          buildId: runtime.buildId,
          signal,
          startupTimeoutMs: 30_000,
          onFailure: (cause) => {
            connectionFailed = true
            buildPending = false
            options.onState?.('failed', cause)
          },
        })
        current = { buildId: runtime.buildId, directory: candidate, processId: child.pid }
        const launched = child
        void launched.exited.then((result) => {
          if (result.code !== 0) retainOutputs = true
          if (child !== launched || replacing || stopping) return
          child = undefined
          current = undefined
          if (result.code !== 0) {
            options.onState?.('failed', new Error('Development application exited unsuccessfully'))
          }
          void session.stop().catch((cause: unknown) => options.onState?.('failed', cause))
        })
        programInputs = runtime.inputs
        if (previous && !retainOutputs) await rm(previous, { recursive: true, force: true })
        options.signal?.removeEventListener('abort', cancelPreparation)
        options.onState?.('ready')
        resolveReady()
      } catch (cause) {
        forceRuntimeBuild = true
        if (launching) {
          retainOutputs = true
        } else if (current?.directory !== candidate) {
          await rm(candidate, { recursive: true, force: true })
        }
        if (!signal.aborted) options.onState?.('failed', cause)
      }
    }

    /** Coalesce changes into serial rebuilds owned by this development session. */
    function enqueue(force = false): void {
      if (stopped || connectionFailed) return
      forceRuntimeBuild ||= force
      buildPending = true
      if (stopping) return
      buildLoop ??= (async () => {
        while (buildPending && !stopping) {
          buildPending = false
          await rebuild()
        }
      })().finally(() => {
        buildLoop = undefined
      })
    }

    const stopWatching = renderer.watch((change) => enqueue(change === 'runtime'))
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
        if (stopped) return Promise.resolve('stopped')
        if (stopPromise) return stopPromise
        stopping = true
        signal.removeEventListener('abort', cancel)
        if (!current) controller.abort(new Error('Development startup cancelled'))
        stopPromise = (async () => {
          await buildLoop
          if (child && (await child.stop()) === 'cancelled') {
            return 'cancelled'
          }

          signal.removeEventListener('abort', cancel)
          options.signal?.removeEventListener('abort', cancelPreparation)
          controller.abort(new Error('Development session stopping'))
          stopWatching()
          const failures: unknown[] = []
          child = undefined
          current = undefined
          let rendererClosed = false
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
            if (buildPending) enqueue()
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
    signal.addEventListener('abort', cancel, { once: true })
    enqueue()
    if (signal.aborted) cancel()
    return session
  } catch (cause) {
    options.signal?.removeEventListener('abort', cancelPreparation)
    if (child) await child.terminate()
    await rendererToClose?.close()
    if (directory) await rm(directory, { recursive: true, force: true })
    throw cause
  }
}
