/** @fileoverview Correlates locally issued requests, cancellation listeners and their single settlement. */

import { RpcError } from '../errors'
import type { RpcFrame } from '../frames'
import type { JsonValue } from '../json'
import type { RpcErrorCodec } from './endpoint'

/** Resolvers and cancellation cleanup for one outbound request. */
interface PendingCall {
  /** Method identity used to decode this call's endpoint-specific failure. */
  method: string
  /** Delivers the peer's successful result to the waiting caller. */
  resolve: (value: JsonValue | void) => void
  /** Delivers a decoded operation failure or connection-loss reason to the caller. */
  reject: (reason: unknown) => void
  /** Detaches this request's cancellation listener. */
  release: () => void
}

/**
 * Pending outbound calls and monotonically allocated IDs for one connection.
 *
 * Settled calls leave the pending map; the ID high-water mark remains to distinguish late replies
 * from unallocated IDs.
 */
export class OutgoingCalls {
  #lastId = 0
  readonly #pending = new Map<number, PendingCall>()

  /** Reports whether the outbound request ID space has been consumed. */
  get exhausted(): boolean {
    return this.#lastId === Number.MAX_SAFE_INTEGER
  }

  /** Reports whether no outbound request is waiting for a reply. */
  get idle(): boolean {
    return this.#pending.size === 0
  }

  /**
   * Registers and sends an outbound request, returning its reply promise.
   *
   * The connection checks ID capacity before admission and owns send-failure handling. A
   * pre-aborted signal throws before sending; later cancellation sends a cancel frame and retains
   * the wait until settlement or closure.
   */
  request(
    method: string,
    args: readonly JsonValue[],
    signal: AbortSignal | undefined,
    send: (frame: RpcFrame) => void,
  ): Promise<JsonValue | void> {
    if (signal?.aborted) {
      throw new RpcError('Cancelled', 'The call was cancelled before sending')
    }

    const id = ++this.#lastId
    return new Promise((resolve, reject) => {
      /** Sends a cancellation request for this call without settling its result. */
      const cancel = () => send({ type: 'cancel', id })
      // Register before sending so a reentrant reply can settle the same call.
      this.#pending.set(id, {
        method,
        resolve,
        reject,

        /** Detaches this pending request's abort listener when its lifetime ends. */
        release: () => signal?.removeEventListener('abort', cancel),
      })
      signal?.addEventListener('abort', cancel, { once: true })
      send({ type: 'request', id, method, args })
    })
  }

  /**
   * Settles an allocated outbound request and detaches its cancellation listener.
   *
   * Late replies are ignored. Replies beyond the allocated ID range throw ProtocolViolation; a
   * decoder exception rejects this call with ProtocolViolation.
   */
  settle(frame: Extract<RpcFrame, { type: 'success' | 'failure' }>, errors: RpcErrorCodec): void {
    if (frame.id > this.#lastId) {
      throw new RpcError('ProtocolViolation', 'Reply for an unallocated request')
    }
    const call = this.#pending.get(frame.id)
    if (!call) {
      return
    }

    this.#pending.delete(frame.id)
    call.release()
    if (frame.type === 'success') {
      call.resolve(frame.value)
    } else {
      try {
        call.reject(errors.decode(frame.error, call.method))
      } catch (cause) {
        call.reject(new RpcError('ProtocolViolation', 'Invalid RPC failure', { cause }))
      }
    }
  }

  /**
   * Rejects all pending requests with the supplied reason and removes their cancellation listeners.
   *
   * Clears pending entries while preserving the allocated ID high-water mark.
   */
  close(reason: RpcError): void {
    for (const call of this.#pending.values()) {
      call.release()
      call.reject(reason)
    }
    this.#pending.clear()
  }
}
