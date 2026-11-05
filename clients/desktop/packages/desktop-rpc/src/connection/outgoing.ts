/** @fileoverview Correlates locally issued requests, cancellation listeners and their single settlement. */

import { RpcError } from '../errors'
import type { RpcFrame } from '../frames'
import type { JsonValue } from '../json'
import type { RpcErrorCodec } from './endpoint'

interface PendingCall {
  method: string
  resolve: (value: JsonValue | void) => void
  reject: (reason: unknown) => void
  release: () => void
}

/** One direction of one connection, including its high-water mark after a reply is delivered. */
export class OutgoingCalls {
  #lastId = 0
  readonly #pending = new Map<number, PendingCall>()

  get exhausted(): boolean {
    return this.#lastId === Number.MAX_SAFE_INTEGER
  }

  get idle(): boolean {
    return this.#pending.size === 0
  }

  /** Register before sending so reentrant replies and cancellations find the same call. */
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
      const cancel = () => send({ type: 'cancel', id })
      this.#pending.set(id, {
        method,
        resolve,
        reject,
        release: () => signal?.removeEventListener('abort', cancel),
      })
      signal?.addEventListener('abort', cancel, { once: true })
      send({ type: 'request', id, method, args })
    })
  }

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

  close(reason: RpcError): void {
    for (const call of this.#pending.values()) {
      call.release()
      call.reject(reason)
    }
    this.#pending.clear()
  }
}
