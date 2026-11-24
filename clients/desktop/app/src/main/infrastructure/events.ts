import {
  extensionEvent,
  parseExtensionEventPayload,
  type EventListener,
  type NativeEventMap,
  type NativeEventName,
  type NativeEventPublisher,
  type ExtensionEventContract,
  type ExtensionEventPublisher,
} from '@kisaki3/desktop-contracts/events'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Disposable } from '@kisaki3/desktop-contracts/operations'

export function createSignal<T>() {
  const listeners = new Set<EventListener<T>>()

  function on(listener: EventListener<T>): Disposable {
    const deliver = (value: T) => listener(value)
    listeners.add(deliver)
    return {
      dispose() {
        listeners.delete(deliver)
      },
    }
  }

  return {
    on,

    observe(listener: (value: T) => void, initial: T): Disposable {
      const hold = on(listener)
      try {
        listener(initial)
        return hold
      } catch (cause) {
        void hold.dispose()
        throw cause
      }
    },

    emit(this: void, value: T) {
      for (const listener of [...listeners]) {
        try {
          const work = listener(value)
          if (work) {
            void work.catch(console.error)
          }
        } catch (error) {
          console.error(error)
        }
      }
    },

    clear() {
      listeners.clear()
    },
  }
}

export function createEvents() {
  const topics = new Map<string, ReturnType<typeof createSignal<unknown>>>()
  const publishers = new Map<string, symbol>()

  function topic(name: string) {
    let current = topics.get(name)
    if (!current) {
      current = createSignal<unknown>()
      topics.set(name, current)
    }
    return current
  }

  function on<K extends NativeEventName>(
    event: K,
    listener: EventListener<NativeEventMap[K]>,
  ): Disposable
  function on<T>(event: ExtensionEventContract<T>, listener: EventListener<T>): Disposable
  function on<T>(
    event: NativeEventName | ExtensionEventContract<T>,
    listener: EventListener<T>,
  ): Disposable {
    if (typeof event === 'string') {
      return topic(event).on((value) =>
        (listener as EventListener<unknown>)(structuredClone(value)),
      )
    }
    return topic(event.ref).on((value) => listener(parseExtensionEventPayload(event, value)))
  }

  return {
    on,

    define<T>(owner: string, id: string, parse: (input: unknown) => T): ExtensionEventPublisher<T> {
      const contract = extensionEvent(owner + ':' + id, parse)
      if (publishers.has(contract.ref)) {
        throw new DesktopError('Conflict', 'This event already has a publisher')
      }

      const registration = Symbol()
      publishers.set(contract.ref, registration)

      return {
        ref: contract.ref,

        async emit(payload) {
          if (publishers.get(contract.ref) !== registration) {
            throw new DesktopError('InstanceExpired', 'The event publisher has ended')
          }
          topic(contract.ref).emit(parseExtensionEventPayload(contract, payload))
        },
        async dispose() {
          if (publishers.get(contract.ref) === registration) {
            publishers.delete(contract.ref)
          }
        },
      }
    },

    publisher<K extends NativeEventName>(name: K): NativeEventPublisher<K> {
      return { emit: topic(name).emit }
    },
  }
}
