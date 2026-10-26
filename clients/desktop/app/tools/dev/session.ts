import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { runPnpm } from '@kisaki3/tooling/process'
import { appRoot, repositoryRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { startRenderer } from './renderer'
import { sourceIdentity } from '../build/identity'
import { prepareResources } from '../resources/prepare'
import { electronExecutable } from './electron-executable'
import { captureDependencies, desktopDependencies } from './dependencies'
import { startElectron } from './electron-process'
import type { DevelopmentProcess } from './electron-process'
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
  /** Cancel compilation, close processes and watchers, then remove this session's outputs. */
  stop(): Promise<void>
}

/** Caller-owned profiles survive stop; cancellation also applies during initial preparation. */
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

  const controller = new AbortController()
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal
  signal.throwIfAborted()
  let directory: string | undefined
  let rendererToClose: Awaited<ReturnType<typeof startRenderer>> | undefined
  let child: DevelopmentProcess | undefined
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
    let initialDependencies: DependencySnapshot | undefined

    try {
      await runPnpm(['exec', 'turbo', ...tasks], { cwd: repositoryRoot, signal })
      initialDependencies = await captureDependencies(
        members,
        join(sessionDirectory, 'dependencies'),
        snapshots,
      )
    } catch (cause) {
      if (signal.aborted) throw cause
      options.onState?.('failed', cause)
    }

    const renderer = await startRenderer(members, initialDependencies)
    rendererToClose = renderer
    signal.throwIfAborted()

    let current: DevelopmentBuild | undefined
    let stopping = false
    let stopPromise: Promise<void> | undefined
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
      try {
        await runPnpm(['exec', 'turbo', ...tasks], { cwd: repositoryRoot, signal })
        const dependencies = await captureDependencies(
          members,
          join(sessionDirectory, 'dependencies'),
          snapshots,
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
        if (stopping) {
          await rm(candidate, { recursive: true, force: true })
          return
        }
        if (!runtime) {
          await renderer.adopt(dependencies)
          options.onState?.('ready')
          return
        }

        const previous = current?.directory
        if (child) await child.stop()
        child = undefined
        current = undefined
        await renderer.adopt(dependencies)
        signal.throwIfAborted()
        child = await startElectron(candidate, profile, renderer.url, runtime.buildId, signal)
        if (!child.pid) throw new Error('Electron process identity is unavailable')
        current = { buildId: runtime.buildId, directory: candidate, processId: child.pid }
        programInputs = runtime.inputs
        if (previous) await rm(previous, { recursive: true, force: true })
        options.onState?.('ready')
        resolveReady()
      } catch (cause) {
        forceRuntimeBuild = true
        await rm(candidate, { recursive: true, force: true })
        if (!signal.aborted) options.onState?.('failed', cause)
      }
    }

    /** Coalesce changes into serial rebuilds owned by this development session. */
    function enqueue(force = false): void {
      if (stopping) return
      forceRuntimeBuild ||= force
      buildPending = true
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
        if (stopPromise) return stopPromise
        stopping = true
        signal.removeEventListener('abort', cancel)
        controller.abort(new Error('Development session stopping'))
        stopWatching()
        stopPromise = (async () => {
          const failures: unknown[] = []
          try {
            await buildLoop
          } catch (cause) {
            failures.push(cause)
          }
          let processesClosed = false
          try {
            if (child) await child.stop()
            processesClosed = true
            current = undefined
          } catch (cause) {
            failures.push(cause)
          }
          let rendererClosed = false
          try {
            await renderer.close()
            rendererClosed = true
          } catch (cause) {
            failures.push(cause)
          }
          if (processesClosed && rendererClosed) {
            try {
              await rm(sessionDirectory, { recursive: true, force: true })
            } catch (cause) {
              failures.push(cause)
            }
          }
          rejectReady(new Error('Development session stopped before readiness'))
          if (failures.length) {
            throw new AggregateError(failures, 'Development session cleanup failed')
          }
          options.onState?.('stopped')
        })()
        void stopPromise.then(resolveClosed, rejectClosed)
        return stopPromise
      },
    }
    signal.addEventListener('abort', cancel, { once: true })
    enqueue()
    if (signal.aborted) cancel()
    return session
  } catch (cause) {
    if (child) await child.stop()
    await rendererToClose?.close()
    if (directory) await rm(directory, { recursive: true, force: true })
    throw cause
  }
}
