import { randomUUID } from 'node:crypto'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Disposable } from '@kisaki3/desktop-contracts/operations'
import type { ReadResourceRef, ViewResourcesApi } from '@kisaki3/desktop-contracts/resources'
import { releaseAll, rethrowAfterRelease } from '../../infrastructure/release'

interface DocumentHold {
  dispose: Disposable['dispose']
  forget(): void
}

export function createDocumentResources(view: ViewResourcesApi, isRevoked: () => boolean) {
  const holds = new Map<string, DocumentHold>()

  async function register<T>(
    value: T,
    dispose: Disposable['dispose'],
    signal: AbortSignal,
    index?: Map<string, T>,
  ) {
    if (isRevoked() || signal.aborted) {
      const cause: unknown = signal.aborted
        ? signal.reason
        : new DesktopError('ConnectionClosed', 'The window document ended')
      return rethrowAfterRelease(cause, dispose)
    }

    const id = randomUUID()
    index?.set(id, value)
    holds.set(id, {
      dispose,
      forget() {
        holds.delete(id)
        index?.delete(id)
      },
    })
    return id
  }

  function keep<T extends Disposable>(value: T, signal: AbortSignal, index?: Map<string, T>) {
    return register(value, () => value.dispose(), signal, index)
  }

  async function bind<T extends Disposable, K extends string>(
    read: T,
    inputs: Readonly<Record<K, ReadResourceRef>>,
    signal: AbortSignal,
    index?: Map<string, T>,
  ) {
    const binding = await view
      .bind(inputs)
      .catch((cause: unknown) => rethrowAfterRelease(cause, () => read.dispose()))
    const hold = await register(
      read,
      () => releaseAll([() => binding.dispose(), () => read.dispose()]),
      signal,
      index,
    )
    return { hold, urls: binding.urls }
  }

  function forget(id: string) {
    holds.get(id)?.forget()
  }

  async function release(id: string) {
    const hold = holds.get(id)
    if (hold) {
      hold.forget()
      await hold.dispose()
    }
  }

  function takeDisposers() {
    return Array.from(holds.values(), (hold) => {
      hold.forget()
      return hold.dispose
    })
  }

  return { keep, bind, forget, release, takeDisposers }
}

export type DocumentResources = ReturnType<typeof createDocumentResources>
