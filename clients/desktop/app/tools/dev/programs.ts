import { build, defaultClientConditions, defaultServerConditions } from 'vite-plus'
import { join } from 'node:path'
import { removeOutputs } from '@kisaki3/tooling/output'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { appRoot } from '../lib/paths'
import { programConfigurations, sourcePrograms } from '../build/programs'
import { sha256 } from '../lib/sha256'

export interface ProgramOutput {
  revision: number
  files: readonly string[]
  digest: string
}

export interface ProgramWatch {
  readonly current: ProgramOutput | undefined
  close(): Promise<void>
}

type ViteWatcher = Extract<
  Awaited<ReturnType<typeof build>>,
  {
    close(): Promise<void>
  }
>

export async function watchPrograms(
  sourceRoot: string,
  directory: string,
  buildId: string,
  onState: (state: 'building' | 'ready' | 'failed', error?: unknown) => void,
): Promise<ProgramWatch> {
  await removeOutputs(appRoot, [directory])
  const entries = []
  for (const program of sourcePrograms(sourceRoot).filter((name) => name !== 'renderer')) {
    const configs = await programConfigurations(
      sourceRoot,
      program,
      join(directory, program),
      buildId,
      'development',
    )
    entries.push(...configs.map((config) => ({ program, config })))
  }

  const outputs = new Map<number, Map<string, string>>()
  const unsettled = new Set(entries.map((_entry, index) => index))
  const watchers: ViteWatcher[] = []
  let revision = 0
  let closed = false

  function current(): ProgramOutput | undefined {
    if (unsettled.size) {
      return undefined
    }
    const files = [...new Map([...outputs.values()].flatMap((output) => [...output]))].sort(
      ([left], [right]) => (left < right ? -1 : Number(left > right)),
    )
    return {
      revision,
      files: files.map(([file]) => file),
      digest: sha256(Buffer.from(JSON.stringify(files))),
    }
  }

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
        resolve: { conditions: ['kisaki-source', ...defaultClientConditions] },
        ssr: { resolve: { conditions: ['kisaki-source', ...defaultServerConditions] } },
        build: { ...config.build, emptyOutDir: false, watch: {} },
        plugins: [
          {
            name: 'desktop-program-completion',
            buildStart() {
              revision += 1
              unsettled.add(index)
              if (!closed) {
                onState('building')
              }
            },
            buildEnd(error) {
              if (error && !closed) {
                onState('failed', error)
              }
            },
            writeBundle(_options, bundle) {
              outputs.set(
                index,
                new Map(
                  Object.entries(bundle).map(([file, output]) => {
                    const source = output.type === 'chunk' ? output.code : output.source
                    return [
                      join(program, file),
                      sha256(typeof source === 'string' ? Buffer.from(source) : source),
                    ]
                  }),
                ),
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
    get current() {
      return current()
    },
    close,
  }
}
