/** @fileoverview Delivers local facts and read invalidations during the lifetime of their owners. */

import type {
  EventListener,
  NativeEventMap,
  NativeEventName,
  NativeEventPublisher,
  ExtensionEventContract,
  ExtensionEventPublisher,
} from '@kisaki3/desktop-contracts/events'
import { extensionEvent, parseExtensionEventPayload } from '@kisaki3/desktop-contracts/events'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Disposable } from '@kisaki3/desktop-contracts/operations'

/** Hands each snapshot to the current subscribers before returning to its publisher. */
export function createSignal<T>() {
  const listeners = new Set<EventListener<T>>()
  return {
    /** Registers one independent subscription to future values. */
    on(this: void, listener: EventListener<T>): Disposable {
      /** Keeps this delivery independent of a second subscription to the same callback. */
      const deliver = (value: T) => listener(value)
      listeners.add(deliver)
      return {
        /** Withdraws just this listener from future handoffs. */
        dispose() {
          listeners.delete(deliver)
        },
      }
    },
    /** Isolates a listener's synchronous failure and its independently accepted asynchronous work. */
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
    /** Releases observers at the natural end of a live observation. */
    clear() {
      listeners.clear()
    },
  }
}

/** Creates application-owned native fact subscriptions and individually scoped publishing rights. */
export function createEvents() {
  const topics = new Map<string, ReturnType<typeof createSignal<unknown>>>()
  const publishers = new Map<string, symbol>()

  /** Creates a topic on its first subscriber or publisher. */
  function topic(name: string) {
    let current = topics.get(name)
    if (!current) {
      current = createSignal<unknown>()
      topics.set(name, current)
    }
    return current
  }

  /** Selects the native payload type from the fact name. */
  function on<K extends NativeEventName>(
    event: K,
    listener: EventListener<NativeEventMap[K]>,
  ): Disposable
  /** Validates a separately declared extension payload for this subscription. */
  function on<T>(event: ExtensionEventContract<T>, listener: EventListener<T>): Disposable
  /** Selects the native topic or the shared extension payload contract for delivery. */
  function on<T>(
    event: NativeEventName | ExtensionEventContract<T>,
    listener: EventListener<T>,
  ): Disposable {
    if (typeof event === 'string') {
      return topic(event).on(listener as EventListener<unknown>)
    }
    return topic(event.ref).on((value) => listener(parseExtensionEventPayload(event, value)))
  }

  return {
    on,
    /** Grants one instance a publisher scoped to its bound extension identity and local name. */
    define<T>(owner: string, id: string, parse: (input: unknown) => T): ExtensionEventPublisher<T> {
      const contract = extensionEvent(owner + ':' + id, parse)
      if (publishers.has(contract.ref)) {
        throw new DesktopError('Conflict', 'This event already has a publisher')
      }
      const registration = Symbol()
      publishers.set(contract.ref, registration)
      return {
        ref: contract.ref,
        /** Validates and hands off a fact from this live publisher. */
        async emit(payload) {
          if (publishers.get(contract.ref) !== registration) {
            throw new DesktopError('InstanceExpired', 'The event publisher has ended')
          }
          topic(contract.ref).emit(parseExtensionEventPayload(contract, payload))
        },
        /** Revokes this instance's publishing authority. */
        async dispose() {
          if (publishers.get(contract.ref) === registration) {
            publishers.delete(contract.ref)
          }
        },
      }
    },
    /** Restricts the domain owner's capability to its assigned fact. */
    publisher<K extends NativeEventName>(name: K): NativeEventPublisher<K> {
      return { emit: topic(name).emit }
    },
  }
}
