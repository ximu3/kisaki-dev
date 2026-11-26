import { createDeferred, createSignal, isPending, onCleanup, until } from 'solid-js'

export function requestSignal(): AbortSignal {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  return controller.signal
}

type QueryResult<T> = { value: T; error?: never } | { error: unknown; value?: never }

export function createViewQuery<T>(read: (signal: AbortSignal, previous?: T) => Promise<T> | T) {
  const lifetime = requestSignal()
  const [revision, invalidate] = createSignal(0)
  const response = createDeferred<QueryResult<T> | undefined>(
    (previous) => {
      revision()
      const answer = read(requestSignal(), previous?.value)
      if (!(answer instanceof Promise)) {
        return { value: answer }
      }
      return answer.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      )
    },
    { loadingValue: undefined },
  )

  const settled = () => response() !== undefined && !isPending(response)
  let trailing: Promise<void> | undefined

  function result() {
    const reply = response()
    // A trailing read already owns the next error shown to the user.
    return reply && 'error' in reply && (trailing || isPending(response)) ? undefined : reply
  }
  const pending = () => result() === undefined || isPending(response)

  function reload() {
    trailing ??= Promise.resolve().then(async () => {
      try {
        await until(settled, { signal: lifetime })
        if (!lifetime.aborted) {
          trailing = undefined
          const next = invalidate((current) => current + 1)
          await until(() => revision() >= next && settled(), { signal: lifetime })
        }
      } catch (error) {
        if (!lifetime.aborted) {
          throw error
        }
      }
    })
    return trailing
  }

  return { result, pending, reload }
}
