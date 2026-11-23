/** @fileoverview Presents independent desktop reads while a window keeps its existing controls mounted. */

import { createEffect, createSignal, onCleanup } from 'solid-js'

/** One read with all reactive inputs already captured. */
type QueryRead<T> = (signal: AbortSignal) => Promise<T>

/** The previous value remains visible while a replacement request is outstanding. */
interface QueryState<T> {
  value?: T | undefined
  error?: unknown
  pending: boolean
}

/** The active read owns its cancellation and the callers waiting for its result. */
interface QueryRequest {
  controller: AbortController
  completion: PromiseWithResolvers<void>
}

/**
 * Owns a view's read, exposing its last successful snapshot, pending state and read error.
 * A prepared read captures reactive inputs; changing them cancels the previous request.
 * Invalidations during a read share one trailing request. Reload completes after its read or
 * the replacement for obsoleted inputs. Accepting a write or disposing releases pending callers.
 */
export function createQuery<T>(source: QueryRead<T> | { prepare: () => QueryRead<T> }) {
  const [state, setState] = createSignal<QueryState<T>>({ pending: true })
  let read: QueryRead<T> | undefined
  let active: QueryRequest | undefined
  let queued: PromiseWithResolvers<void> | undefined
  let disposed = false

  function release() {
    const waiting = queued
    queued = undefined
    active?.controller.abort()
    active?.completion.resolve()
    waiting?.resolve()
  }

  async function loadNext() {
    if (active || !queued || !read) {
      return
    }

    const completion = queued
    const controller = new AbortController()
    const { signal } = controller
    active = { controller, completion }
    queued = undefined
    setState(({ value }) => ({ value, pending: true }))

    try {
      const value = await read(signal)
      if (!signal.aborted) {
        setState({ value, pending: !!queued })
      }
    } catch (error) {
      if (!signal.aborted && !queued) {
        setState(({ value }) => ({ value, error, pending: false }))
      }
    }

    active = undefined
    if (!signal.aborted) {
      completion.resolve()
    }
    if (queued) {
      queueMicrotask(() => void loadNext())
    }
  }

  function reload(): Promise<void> {
    if (disposed) {
      return Promise.resolve()
    }

    queued ??= Promise.withResolvers<void>()
    queueMicrotask(() => void loadNext())
    return queued.promise
  }

  const prepare = typeof source === 'function' ? () => source : source.prepare
  createEffect(prepare, (next) => {
    read = next
    if (active && !active.controller.signal.aborted) {
      active.controller.abort()
      if (queued) {
        void queued.promise.then(active.completion.resolve)
      } else {
        queued = active.completion
      }
    }
    void reload()
  })
  onCleanup(() => {
    disposed = true
    release()
  })

  return {
    get value() {
      return state().value
    },
    get error() {
      return state().error
    },
    get pending() {
      return state().pending
    },
    reload,
    accept(value: T) {
      if (!disposed) {
        setState({ value, pending: false })
        release()
      }
    },
  }
}
