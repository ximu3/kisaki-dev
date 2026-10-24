import type { ChildProcess } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { appRoot, repositoryRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { readPnpm, runPnpm } from '../lib/process'
import { startRenderer } from './renderer'
import { sourceIdentity } from '../build/identity'
import { prepareResources } from '../resources/prepare'
import { electronExecutable } from './electron-executable'
import { captureDependencies } from './dependencies'
import { startElectron, stopElectron } from './electron-process'
import { buildGeneration, programInputsChanged } from './generation'
import type { DependencySnapshot, WorkspaceDependency } from './dependencies'
import type { DesktopTarget } from '../../src/shared/runtime-manifest'

/** The built runtime and Electron process currently owned by a development session. */
export interface DevelopmentBuild {
  buildId: string
  directory: string
  processId: number
}

/** A complete development session; stop waits for all processes, builds and watchers to close. */
export interface DevelopmentSession {
  /** Resolves on the first successful startup; stopping before then rejects it. */
  readonly ready: Promise<void>
  readonly rendererUrl: string
  /** The running generation, or undefined before startup and after shutdown. */
  readonly current: DevelopmentBuild | undefined
  /** Wait for builds, processes and Vite to close, then remove this session's outputs. */
  stop(): Promise<void>
}

/** Inputs for a local development session; caller-owned profiles survive stop and rebuild. */
export interface DevelopmentOptions {
  /** Absolute profile path; defaults to the application's .local/development directory. */
  profile?: string
  /** Synchronous state notifications; failed includes the build or startup cause. */
  onState?: (state: 'building' | 'failed' | 'ready' | 'stopped', error?: unknown) => void
}

/** Create a session output directory and transfer its lock to the caller. */
async function createSessionWorkspace(
  target: DesktopTarget,
): Promise<{ directory: string; lockDirectory: string }> {
  const output = join(appRoot, 'out', 'development', target)
  await mkdir(output, { recursive: true })

  const lockDirectory = join(output, '.session-lock')
  await mkdir(lockDirectory)

  try {
    const directory = await mkdtemp(join(output, 'session-'))
    return { directory, lockDirectory }
  } catch (cause) {
    await rm(lockDirectory, { recursive: true, force: true })
    throw cause
  }
}

/** Start Vite and an Electron session; callers await ready and release the session with stop(). */
export async function startDevelopmentSession(
  options: DevelopmentOptions = {},
): Promise<DevelopmentSession> {
  const target = hostTarget()
  const profile = options.profile ?? join(appRoot, '.local', 'development')
  if (!isAbsolute(profile)) throw new Error('Development profile must be an absolute path')

  const { directory, lockDirectory } = await createSessionWorkspace(target)

  let rendererToClose: Awaited<ReturnType<typeof startRenderer>> | undefined
  let child: ChildProcess | undefined
  const snapshots = new Map<string, DependencySnapshot>()
  let initialDependencies: DependencySnapshot | undefined

  try {
    await mkdir(profile, { recursive: true })
    const members: WorkspaceDependency[] = JSON.parse(
      await readPnpm(
        ['list', '--filter', '@kisaki3/desktop^...', '--depth', '-1', '--json'],
        repositoryRoot,
      ),
    )
    electronExecutable()
    await prepareResources(target)

    try {
      await runPnpm(['exec', 'turbo', 'run', 'build', '--filter=@kisaki3/desktop^...'], {
        cwd: repositoryRoot,
      })
      initialDependencies = await captureDependencies(
        members,
        join(directory, 'dependencies'),
        snapshots,
      )
    } catch (cause) {
      options.onState?.('failed', cause)
    }

    const renderer = await startRenderer(members, initialDependencies)
    rendererToClose = renderer

    let current: DevelopmentBuild | undefined
    let stopping = false
    let stopPromise: Promise<void> | undefined
    let buildPending = false
    let buildLoop: Promise<void> | undefined

    let resolveReady!: () => void
    let rejectReady!: (cause: unknown) => void
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    // Stop may occur before a caller starts awaiting readiness.
    void ready.catch(() => undefined)

    let generation = 0
    let forceRuntimeBuild = true
    let programInputs = new Map<string, string>()

    /** Adopt a successful candidate, or retain the current process when compilation fails. */
    async function rebuild(): Promise<void> {
      options.onState?.('building')
      const candidate = join(directory, `generation-${++generation}`)
      try {
        await runPnpm(['exec', 'turbo', 'run', 'build', '--filter=@kisaki3/desktop^...'], {
          cwd: repositoryRoot,
        })
        const nextDependencies = await captureDependencies(
          members,
          join(directory, 'dependencies'),
          snapshots,
        )
        const forced = forceRuntimeBuild
        forceRuntimeBuild = false
        const needsRuntimeBuild = !current || forced || (await programInputsChanged(programInputs))
        if (!needsRuntimeBuild) {
          await renderer.adopt(nextDependencies)
          options.onState?.('ready')
          return
        }

        const { buildId, inputs: nextInputs } = await buildGeneration(target, candidate)

        if (stopping || buildId !== (await sourceIdentity())) {
          buildPending = !stopping
          await rm(candidate, { recursive: true, force: true })
          return
        }

        const previous = current?.directory
        if (child) await stopElectron(child)
        child = undefined
        current = undefined

        await renderer.adopt(nextDependencies)

        child = await startElectron(candidate, profile, renderer.url, buildId)
        if (!child.pid) throw new Error('Electron process identity is unavailable')
        current = { buildId, directory: candidate, processId: child.pid }
        programInputs = nextInputs
        if (previous) await rm(previous, { recursive: true, force: true })
        options.onState?.('ready')
        resolveReady()
      } catch (cause) {
        forceRuntimeBuild = true
        await rm(candidate, { recursive: true, force: true })
        options.onState?.('failed', cause)
      }
    }

    /** Coalesce file changes into serial builds; changes during a build schedule the next one. */
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
    enqueue()

    return {
      ready,
      get rendererUrl() {
        return renderer.url
      },
      get current() {
        return current
      },
      stop() {
        stopPromise ??= (async () => {
          stopping = true
          stopWatching()
          await buildLoop

          if (child) await stopElectron(child)
          current = undefined
          await renderer.close()

          await rm(directory, { recursive: true, force: true })
          await rm(lockDirectory, { recursive: true, force: true })

          rejectReady(new Error('Development session stopped before readiness'))
          options.onState?.('stopped')
        })()
        return stopPromise
      },
    }
  } catch (cause) {
    if (child) await stopElectron(child)
    await rendererToClose?.close()
    await rm(directory, { recursive: true, force: true })
    await rm(lockDirectory, { recursive: true, force: true })
    throw cause
  }
}
