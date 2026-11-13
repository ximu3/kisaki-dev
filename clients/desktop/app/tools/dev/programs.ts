/** @fileoverview Owns native Vite program watchers and their completed output inventories. */

import { build } from 'vite'
import { join } from 'node:path'
import { removeOutputs } from '@kisaki3/tooling/output'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { appRoot } from '../lib/paths'
import { programConfigurations } from '../build/programs'

/** One compiler batch whose output files are ready to copy into a runtime directory. */
export interface ProgramOutput {
  revision: number
  files: readonly string[]
}

/** Compiler owner exposing completed output and deterministic shutdown. */
export interface ProgramWatch {
  /** Absent while any compiler is running or has failed. */
  readonly current: ProgramOutput | undefined
  /** Closes every compiler before its workspace can be removed. */
  close(): Promise<void>
}

/** Native persistent build handle returned by Vite. */
type ViteWatcher = Extract<
  Awaited<ReturnType<typeof build>>,
  {
    /** Releases the native compiler watch handle. */
    close(): Promise<void>
  }
>

/**
 * Watches main, preload and extension-host using the compiler's own module graph.
 *
 * Completion follows writeBundle. Failed compilation invalidates the current batch until repair;
 * close waits for all compiler handles. The caller owns the supplied workspace directory.
 */
export async function watchPrograms(
  sourceRoot: string,
  directory: string,
  buildId: string,
  onState: (state: 'building' | 'ready' | 'failed', error?: unknown) => void,
): Promise<ProgramWatch> {
  await removeOutputs(appRoot, [directory])
  const entries = []
  for (const program of ['main', 'preload', 'extension-host'] as const) {
    const configs = await programConfigurations(
      sourceRoot,
      program,
      join(directory, program),
      buildId,
      'development',
    )
    entries.push(...configs.map((config) => ({ program, config })))
  }

  const outputs = new Map<number, string[]>()
  const unsettled = new Set(entries.map((_entry, index) => index))
  const watchers: ViteWatcher[] = []
  let revision = 0
  let closed = false

  /** Returns the exact last-written files only after every compiler has completed successfully. */
  function current(): ProgramOutput | undefined {
    return unsettled.size
      ? undefined
      : { revision, files: [...new Set([...outputs.values()].flat())] }
  }

  /** Waits for every owned watcher and preserves all shutdown failures. */
  async function close(): Promise<void> {
    closed = true
    const results = await Promise.allSettled(watchers.map((watcher) => watcher.close()))
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length) {
      throw new AggregateError(
        failures.map((result): unknown => result.reason),
        'Program compiler shutdown failed',
      )
    }
  }

  try {
    for (const [index, { program, config }] of entries.entries()) {
      const watcher = await build({
        ...config,
        build: { ...config.build, emptyOutDir: false, watch: {} },
        plugins: [
          {
            name: 'desktop-program-completion',
            /** Invalidates the output inventory before this compiler starts writing a new batch. */
            buildStart() {
              revision += 1
              unsettled.add(index)
              if (!closed) {
                onState('building')
              }
            },
            /** Keeps failed output unavailable while the native watcher waits for a repair. */
            buildEnd(error) {
              if (error && !closed) {
                onState('failed', error)
              }
            },
            /** Publishes the files actually written by this completed compiler. */
            writeBundle(_options, bundle) {
              outputs.set(
                index,
                Object.keys(bundle).map((file) => join(program, file)),
              )
              unsettled.delete(index)
              if (!closed && current()) {
                onState('ready')
              }
            },
          },
        ],
      })
      if (Array.isArray(watcher) || 'output' in watcher) {
        throw new Error('A program watch did not return its compiler handle')
      }
      watchers.push(watcher)
    }
  } catch (cause) {
    return rethrowAfterCleanup(cause, close, 'Program watch startup and cleanup failed')
  }

  return {
    /** Reads the latest completed compiler batch. */
    get current() {
      return current()
    },
    close,
  }
}
