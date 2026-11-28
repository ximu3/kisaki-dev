import { watch, type FSWatcher } from 'node:fs'
import { dirname, join } from 'node:path'
import type { FileWorkType, WorkRef, LibraryChange } from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import { registeredRelation } from '../../../infrastructure/files/registered-path'
import type { createRefresh } from './refresh'
import type { createRecognition } from './recognition'

type Work = WorkRef<FileWorkType>
import type { WatchTarget } from './watch-targets'
interface Binding {
  target: WatchTarget
  release?: () => void
  timer?: NodeJS.Timeout
}
interface Request {
  work: Work
  paths: Set<string>
  discovery: Set<string>
  files: Set<string>
}
export function watchHoldings(
  targets: () => Promise<WatchTarget[]>,
  refresh: ReturnType<typeof createRefresh>,
  recognition: ReturnType<typeof createRecognition>,
  native: NativeFiles,
  report: (error: unknown) => void,
) {
  const retries = new Set<Promise<void>>()
  const subscriptions = new Map<
    string,
    {
      handle: FSWatcher
      listeners: Set<(name: string | null) => void>
      errors: Set<(err: unknown) => void>
    }
  >()
  const watched = new Map<string, Binding>(),
    pending = new Map<string, Request>()
  let life: AbortController | undefined,
    syncing: Promise<void> = Promise.resolve(),
    running: Promise<void> | undefined,
    debounce: NodeJS.Timeout | undefined
  function schedule(work: Work, path: string, kind: 'all' | 'recognition' | 'discovery' = 'all') {
    if (!life) {
      return
    }
    const request = pending.get(work.id) ?? {
      work,
      paths: new Set<string>(),
      discovery: new Set<string>(),
      files: new Set<string>(),
    }
    if (kind === 'recognition') {
      request.files.add(path)
    } else {
      request.discovery.add(path)
      if (kind === 'all') {
        request.paths.add(path)
      }
    }
    pending.set(work.id, request)
    if (!debounce && !running) {
      debounce = setTimeout(flush, 100)
    }
  }
  function flush() {
    debounce = undefined
    const signal = life?.signal
    if (!signal || running) {
      return
    }
    const requests = [...pending.values()]
    pending.clear()
    running = (async () => {
      for (const req of requests) {
        if (signal.aborted) {
          break
        }
        try {
          if (req.discovery.size) {
            await refresh(req.work, signal, [...req.discovery], [...req.paths])
          }
          await recognition.withAutomatic(req.work, signal, async (one) => {
            for (const id of req.files) {
              signal.throwIfAborted()
              await one(id)
            }
          })
        } catch (cause) {
          if (!signal.aborted) {
            report(cause)
          }
        }
      }
    })().finally(() => {
      running = undefined
      if (pending.size && life) {
        flush()
      }
    })
  }
  function release(binding: Binding) {
    binding.release?.()
    delete binding.release
    clearTimeout(binding.timer)
    delete binding.timer
  }
  function attach(binding: Binding) {
    const { target } = binding,
      signal = life!.signal
    const root = target.kind === 'file' ? dirname(target.path) : target.path
    function fallback() {
      if (signal.aborted || binding.timer) {
        return
      }
      binding.release?.()
      delete binding.release
      binding.timer = setTimeout(() => {
        delete binding.timer
        if (signal.aborted) {
          return
        }
        const retry = refresh(target.work, signal, [target.path])
          .then(() => {})
          .catch((cause) => {
            if (!signal.aborted) {
              report(cause)
            }
          })
          .finally(() => {
            if (!signal.aborted && watched.get(target.id) === binding) {
              attach(binding)
              if (binding.release) {
                schedule(target.work, target.path)
              }
            }
          })
        retries.add(retry)
        void retry.finally(() => retries.delete(retry))
      }, 300000)
      binding.timer.unref()
    }
    try {
      const key = JSON.stringify([root, target.kind !== 'file'])
      let shared = subscriptions.get(key)
      if (!shared) {
        const listeners = new Set<(name: string | null) => void>(),
          errors = new Set<(cause: unknown) => void>()
        const handle = watch(
          root,
          { recursive: target.kind !== 'file', persistent: false },
          (_event, name) => {
            for (const notify of listeners) {
              notify(name)
            }
          },
        )
        handle.on('error', (cause) => {
          for (const fail of [...errors]) {
            fail(cause)
          }
        })
        handle.on('close', () => {
          if (subscriptions.get(key)?.handle === handle) {
            for (const fail of [...errors]) {
              fail(new Error('The filesystem watcher closed'))
            }
          }
        })
        shared = { handle, listeners, errors }
        subscriptions.set(key, shared)
      }
      const subscription = shared
      const notify = (name: string | null) => {
        if (signal.aborted) {
          return
        }
        if (!name) {
          schedule(target.work, target.path)
          return
        }
        const path = join(root, name)
        if (target.kind === 'root') {
          schedule(target.work, path)
          return
        }
        if (target.kind === 'pages') {
          schedule(target.work, target.path)
          return
        }
        void registeredRelation(target.path, path, native).then(
          (result) => {
            if (!signal.aborted && (result === 'same' || result === 'unknown')) {
              schedule(target.work, target.path)
            }
          },
          (cause) => {
            if (!signal.aborted) {
              report(cause)
            }
          },
        )
      }
      const failure = (cause: unknown) => {
        if (signal.aborted || watched.get(target.id) !== binding) {
          return
        }
        report(cause)
        schedule(target.work, target.path)
        fallback()
      }
      subscription.listeners.add(notify)
      subscription.errors.add(failure)
      binding.release = () => {
        subscription.listeners.delete(notify)
        subscription.errors.delete(failure)
        if (!subscription.listeners.size) {
          subscriptions.delete(key)
          subscription.handle.close()
        }
      }
    } catch (cause) {
      report(cause)
      fallback()
    }
  }
  let needsSync = false,
    fullSync = false,
    updating = false
  function sync(all = false) {
    const signal = life?.signal
    if (!signal) {
      return Promise.resolve()
    }
    needsSync = true
    fullSync ||= all
    if (updating) {
      return syncing
    }
    updating = true
    syncing = syncing
      .then(async () => {
        while (needsSync && life) {
          const signal = life.signal,
            all = fullSync
          needsSync = false
          fullSync = false
          if (signal.aborted) {
            continue
          }
          const actual = await targets()
          if (signal.aborted) {
            continue
          }
          const keep = new Set(actual.map((row) => row.id))
          for (const [id, binding] of watched) {
            if (!keep.has(id)) {
              watched.delete(id)
              release(binding)
            }
          }
          for (const target of actual) {
            const previous = watched.get(target.id),
              locationChanged =
                !previous ||
                previous.target.path !== target.path ||
                previous.target.kind !== target.kind
            if (all || locationChanged) {
              if (previous) {
                watched.delete(target.id)
                release(previous)
              }
              const binding = { target }
              watched.set(target.id, binding)
              attach(binding)
              schedule(target.work, target.path)
            } else if (previous) {
              if (previous.target.discovery !== target.discovery) {
                schedule(target.work, target.path, 'discovery')
              }
              if (previous.target.profileId !== target.profileId) {
                await matchUnder(target, signal)
              }
              previous.target = target
            }
          }
        }
      })
      .catch((cause) => {
        if (!signal.aborted) {
          report(cause)
        }
      })
      .finally(() => {
        updating = false
        if (needsSync && life) {
          void sync()
        }
      })
    return syncing
  }
  async function matchUnder(root: WatchTarget, signal: AbortSignal) {
    for (const { target } of watched.values()) {
      if (target.kind === 'root' || target.work.id !== root.work.id) {
        continue
      }
      const relation = await registeredRelation(root.path, target.path, native)
      if (signal.aborted) {
        return
      }
      if (relation === 'contains' || relation === 'same') {
        schedule(target.work, target.id, 'recognition')
      }
    }
  }
  function libraryChanged(changes: readonly LibraryChange[]) {
    if (!life) {
      return
    }
    const works = new Set<string>()
    let refreshLocations = false
    for (const change of changes) {
      if (change.type === 'entryDeleted' || change.type === 'entriesMerged') {
        refreshLocations = true
      } else if (change.type === 'partMoved') {
        works.add(change.fromWork.id)
        works.add(change.toWork.id)
      } else if (
        change.type === 'partCreated' ||
        change.type === 'partUpdated' ||
        change.type === 'partDeleted' ||
        change.type === 'partMerged' ||
        change.type === 'partKindChanged'
      ) {
        works.add(change.work.id)
      }
    }
    if (refreshLocations) {
      void sync()
    }
    if (works.size) {
      for (const { target } of watched.values()) {
        if (target.kind !== 'root' && works.has(target.work.id)) {
          schedule(target.work, target.id, 'recognition')
        }
      }
    }
  }
  function rulesChanged(type: FileWorkType, id: string | null) {
    const signal = life?.signal
    if (!signal || !id) {
      return
    }
    for (const { target } of watched.values()) {
      if (target.kind === 'root' && target.work.type === type && target.profileId === id) {
        void matchUnder(target, signal).catch(report)
      }
    }
  }
  function stop() {
    life?.abort()
    life = undefined
    clearTimeout(debounce)
    debounce = undefined
    pending.clear()
    for (const binding of watched.values()) {
      release(binding)
    }
    watched.clear()
    recognition.clearWaiting()
  }
  return {
    sync,
    libraryChanged,
    matchFile: ({ work, id }: { work: Work; id: string }) => schedule(work, id, 'recognition'),
    rulesChanged,
    fileReleased(type: string, id: string) {
      const target = watched.get(id)?.target
      if (target && target.work.type === type && recognition.consumeWaiting(id)) {
        schedule(target.work, id, 'recognition')
      }
    },
    setEnabled(enabled: boolean) {
      if (enabled === !!life) {
        return
      }
      if (!enabled) {
        stop()
        return
      }
      life = new AbortController()
      void sync(true)
    },
    resume() {
      void sync(true)
    },
    async close() {
      stop()
      await syncing
      await running
      await Promise.allSettled(retries)
    },
  }
}
