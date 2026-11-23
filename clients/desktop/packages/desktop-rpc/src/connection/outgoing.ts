import { RpcError } from '../errors'
import type { RpcFrame } from '../frames'
import type { JsonValue } from '../json'
import type { RpcErrorCodec } from './endpoint'

interface PendingCall {
  method: string
  resolve: (value: JsonValue | void) => void
  reject: (reason: unknown) => void
  detachAbort: () => void
}

export class OutgoingCalls {
  #lastId = 0
  readonly #pending = new Map<number, PendingCall>()

  get exhausted(): boolean {
    return this.#lastId === Number.MAX_SAFE_INTEGER
  }

  get idle(): boolean {
    return this.#pending.size === 0
  }

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
      const sendCancel = () => send({ type: 'cancel', id })

      this.#pending.set(id, {
        method,
        resolve,
        reject,
        detachAbort: () => signal?.removeEventListener('abort', sendCancel),
      })
      signal?.addEventListener('abort', sendCancel, { once: true })

      // Sending can synchronously deliver the reply.
      send({ type: 'request', id, method, args })
    })
  }

  settle(frame: Extract<RpcFrame, { type: 'success' | 'failure' }>, errors: RpcErrorCodec): void {
    if (frame.id > this.#lastId) {
      throw new RpcError('ProtocolViolation', 'Reply for an unallocated request')
    }
    const call = this.#pending.get(frame.id)
    if (!call) {
      // An allocated ID with no pending entry belongs to an already settled call.
      return
    }

    this.#pending.delete(frame.id)
    call.detachAbort()
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
      call.detachAbort()
      call.reject(reason)
    }
    this.#pending.clear()
  }
}
