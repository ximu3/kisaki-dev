/** @fileoverview Owns RPC handshakes, concurrent directional calls, notifications, and closure. */

import { parseRpcError, RpcError, serializeRpcError } from './errors'
import { parseRpcFrame, rpcWireVersion, type RpcFrame, type RpcProtocol } from './frames'
import { isJsonValue, type JsonValue } from './json'
import type { MessageTransport } from './transport'

/** Execution cancellation belongs to the handler; a cancel frame does not invent a result. */
export interface RpcRequestContext {
  readonly signal: AbortSignal
}

/** An explicitly exposed method; the endpoint validates arguments and enforces permissions. */
export type RpcMethod = (
  args: readonly JsonValue[],
  context: RpcRequestContext,
) => JsonValue | void | Promise<JsonValue | void>

/** One connection's identity checks, message surface, and safe failure conversion. */
export interface RpcConnectionOptions {
  readonly transport: MessageTransport
  readonly protocol: RpcProtocol
  readonly handshake:
    | {
        readonly role: 'initiator'
        readonly context: JsonValue
        readonly validateAccepted: (context: JsonValue) => void
      }
    | { readonly role: 'acceptor'; readonly accept: (context: JsonValue) => JsonValue }
  readonly methods?: Readonly<Record<string, RpcMethod>>
  readonly notifications?: Readonly<Record<string, (value: JsonValue) => void | Promise<void>>>
  /** Report local notification, serialization, or cleanup failures; must not throw. */
  readonly reportError: (error: unknown) => void
  /** Convert endpoint failures, including legal partial results, to safe transferable values. */
  readonly serializeError?: (error: unknown) => JsonValue
  /** Validate and restore endpoint failures. A parser failure closes the connection. */
  readonly parseError?: (value: JsonValue) => Error
}

interface PendingRequest {
  readonly resolve: (value: JsonValue | void) => void
  readonly reject: (reason: unknown) => void
  readonly release: () => void
}

/**
 * A single owned transport. Await ready before calling or notifying. Closure rejects waiting
 * calls without claiming rollback, aborts local handlers, and never replays a write.
 */
export class RpcConnection {
  readonly ready: Promise<JsonValue>
  /** Resolves when the connection stops delivering, before local handlers necessarily finish. */
  readonly closed: Promise<RpcError>
  private readonly options: RpcConnectionOptions
  private readonly pending = new Map<number, PendingRequest>()
  private readonly incoming = new Map<number, AbortController>()
  private readonly running = new Set<Promise<void>>()
  private readonly releases: (() => void)[] = []
  private readonly resolveReady: (value: JsonValue) => void
  private readonly rejectReady: (reason: unknown) => void
  private readonly resolveClosed: (reason: RpcError) => void
  private handshakeTimer: ReturnType<typeof setTimeout> | undefined
  private phase: 'connecting' | 'ready' | 'closed' = 'connecting'
  private sentId = 0
  private receivedId = 0
  private closeReason: RpcError | undefined

  constructor(options: RpcConnectionOptions) {
    this.options = options
    const ready = deferred<JsonValue>()
    this.ready = ready.promise
    this.resolveReady = ready.resolve
    this.rejectReady = ready.reject
    const closed = deferred<RpcError>()
    this.closed = closed.promise
    this.resolveClosed = closed.resolve

    this.handshakeTimer = setTimeout(() => {
      this.disconnect(
        new RpcError('ConnectionClosed', 'The RPC handshake did not complete within ten seconds.'),
      )
    }, 10_000)

    try {
      this.subscribe(
        options.transport.onClose(() => {
          this.disconnect(new RpcError('ConnectionClosed', 'The RPC transport closed.'))
        }),
      )
      if (this.phase === 'closed') {
        return
      }
      this.subscribe(options.transport.onMessage((message) => this.receive(message)))
      if (options.handshake.role === 'initiator') {
        this.send(
          parseRpcFrame({
            type: 'hello',
            wireVersion: rpcWireVersion,
            protocol: options.protocol,
            context: options.handshake.context,
          }),
        )
      }
    } catch (cause) {
      this.disconnect(
        new RpcError('ConnectionClosed', 'The RPC transport could not be initialized.', { cause }),
      )
    }
  }

  /** Current connection phase; a closed instance cannot be reconnected. */
  get state(): 'connecting' | 'ready' | 'closed' {
    return this.phase
  }

  /**
   * Wait for one actual reply. An already aborted signal prevents sending; later cancellation
   * requests remote cleanup and still waits for its result. There is no business timeout.
   */
  call(
    method: string,
    args: readonly JsonValue[],
    signal?: AbortSignal,
  ): Promise<JsonValue | void> {
    try {
      this.requireReady()
      if (signal?.aborted) {
        throw new RpcError('Cancelled', 'The request was cancelled before sending.')
      }
      if (this.sentId === Number.MAX_SAFE_INTEGER) {
        this.disconnect(
          new RpcError('ConnectionClosed', 'The request identifier range is exhausted.'),
        )
        throw this.closeReason
      }
      const id = this.sentId + 1
      const frame = parseRpcFrame({ type: 'request', id, method, args })
      this.sentId = id

      return new Promise((resolve, reject) => {
        const cancel = (): void => {
          this.send({ type: 'cancel', id })
        }
        this.pending.set(id, {
          resolve,
          reject,
          release: () => signal?.removeEventListener('abort', cancel),
        })
        signal?.addEventListener('abort', cancel, { once: true })
        this.send(frame)
      })
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /** Send a defined notification. Delivery has no acknowledgement or transaction semantics. */
  notify(topic: string, value: JsonValue): void {
    this.requireReady()
    this.send(parseRpcFrame({ type: 'notify', topic, value }))
    if (this.closeReason) {
      throw this.closeReason
    }
  }

  /** Close immediately, then wait for locally owned handlers and notifications to settle. Idempotent. */
  async close(): Promise<void> {
    this.disconnect(new RpcError('ConnectionClosed', 'The RPC connection was closed.'))
    await Promise.allSettled(this.running)
  }

  /** Parse and dispatch synchronously; handlers run without blocking the message pump. */
  private receive(message: unknown): void {
    if (this.phase === 'closed') {
      return
    }
    try {
      const frame = parseRpcFrame(message)
      if (this.phase === 'connecting') {
        this.handshake(frame)
        return
      }

      switch (frame.type) {
        case 'request':
          if (frame.id !== this.receivedId + 1) {
            throw new RpcError(
              'ProtocolViolation',
              'The peer sent an out-of-sequence request identifier.',
            )
          }
          this.receivedId = frame.id
          this.execute(frame)
          return
        case 'success':
        case 'failure':
          this.reply(frame)
          return
        case 'cancel':
          if (frame.id > this.receivedId) {
            throw new RpcError('ProtocolViolation', 'The peer cancelled an unknown request.')
          }
          this.incoming.get(frame.id)?.abort()
          return
        case 'notify': {
          const handler = own(this.options.notifications, frame.topic)
          if (!handler) {
            throw new RpcError('ProtocolViolation', 'The peer sent an unknown notification.')
          }
          this.track(
            Promise.resolve()
              .then(() => handler(frame.value))
              .catch((error: unknown) => this.options.reportError(error)),
          )
          return
        }
        case 'hello':
        case 'accepted':
        case 'rejected':
          throw new RpcError('ProtocolViolation', 'The peer repeated the RPC handshake.')
      }
    } catch (error) {
      const reason =
        error instanceof RpcError
          ? error
          : new RpcError('ProtocolViolation', 'The RPC message could not be accepted.', {
              cause: error,
            })
      if (
        this.phase === 'connecting' &&
        this.options.handshake.role === 'acceptor' &&
        reason.code === 'ProtocolMismatch'
      ) {
        this.disconnect(reason, {
          type: 'rejected',
          error: { code: reason.code, message: reason.message },
        })
        return
      }
      this.disconnect(reason)
    }
  }

  /** Bind a peer only after the endpoint's actual context and protocol have been checked. */
  private handshake(frame: RpcFrame): void {
    const handshake = this.options.handshake
    if (handshake.role === 'initiator') {
      if (frame.type === 'rejected') {
        this.disconnect(new RpcError(frame.error.code, frame.error.message))
        return
      }
      if (frame.type !== 'accepted') {
        throw new RpcError('ProtocolViolation', 'The RPC handshake has not been accepted.')
      }
      handshake.validateAccepted(frame.context)
      this.accept(frame.context)
      return
    }

    if (frame.type !== 'hello') {
      throw new RpcError('ProtocolViolation', 'The RPC handshake must begin with hello.')
    }
    if (
      frame.protocol.id !== this.options.protocol.id ||
      frame.protocol.version !== this.options.protocol.version
    ) {
      throw new RpcError('ProtocolMismatch', 'The endpoint protocol does not match.')
    }
    let context: JsonValue
    try {
      context = handshake.accept(frame.context)
      if (!isJsonValue(context)) {
        throw new RpcError('ProtocolViolation', 'The endpoint produced an invalid acceptance.')
      }
    } catch (error) {
      const failure =
        error instanceof RpcError
          ? error
          : new RpcError('PermissionDenied', 'The connection could not be accepted.')
      this.disconnect(failure, {
        type: 'rejected',
        error: { code: failure.code, message: failure.message },
      })
      return
    }

    // Mark ready before sending, so a synchronous transport can deliver the peer's first call.
    this.phase = 'ready'
    this.send({ type: 'accepted', context })
    if (!this.closeReason) {
      this.accept(frame.context)
    }
  }

  /** Finish the handshake and remove its only deadline. */
  private accept(context: JsonValue): void {
    this.phase = 'ready'
    clearTimeout(this.handshakeTimer)
    this.handshakeTimer = undefined
    this.resolveReady(context)
  }

  /** Own one inbound handler until it has produced its real result or completed cleanup. */
  private execute(frame: Extract<RpcFrame, { type: 'request' }>): void {
    const controller = new AbortController()
    this.incoming.set(frame.id, controller)
    const handler = own(this.options.methods, frame.method)
    const work = Promise.resolve().then(async () => {
      try {
        if (!handler) {
          throw new RpcError('InvalidInput', 'The requested method is not exposed.')
        }
        const value = await handler(frame.args, { signal: controller.signal })
        if (value !== undefined && !isJsonValue(value)) {
          throw new RpcError('OperationFailed', 'The operation produced an invalid transfer value.')
        }
        this.send(
          value === undefined
            ? { type: 'success', id: frame.id }
            : { type: 'success', id: frame.id, value },
        )
      } catch (error) {
        if (this.phase !== 'closed') {
          let failure: JsonValue
          try {
            failure = (this.options.serializeError ?? serializeRpcError)(error)
            if (!isJsonValue(failure)) {
              throw new RpcError(
                'OperationFailed',
                'The failure serializer produced an invalid transfer value.',
              )
            }
          } catch (serializationError) {
            this.options.reportError(serializationError)
            failure = serializeRpcError(serializationError)
          }
          this.send({ type: 'failure', id: frame.id, error: failure })
        }
      } finally {
        this.incoming.delete(frame.id)
      }
    })
    this.track(work)
  }

  /** Deliver one correlated result and release cancellation observation. */
  private reply(frame: Extract<RpcFrame, { type: 'success' | 'failure' }>): void {
    if (frame.id > this.sentId) {
      throw new RpcError('ProtocolViolation', 'The peer replied to an unallocated request.')
    }
    const request = this.pending.get(frame.id)
    if (!request) {
      return
    }
    const error =
      frame.type === 'failure' ? (this.options.parseError ?? parseRpcError)(frame.error) : undefined
    this.pending.delete(frame.id)
    request.release()
    if (frame.type === 'success') {
      request.resolve(frame.value)
    } else {
      request.reject(error)
    }
  }

  /** Track local work so explicit closure can await cleanup, including error observers. */
  private track(work: Promise<void>): void {
    const tracked = work
      .catch((error: unknown) => {
        this.disconnect(
          new RpcError('ConnectionClosed', 'A local RPC observer failed.', { cause: error }),
        )
      })
      .finally(() => this.running.delete(tracked))
    this.running.add(tracked)
  }

  /** A transport may report an already-closed channel while a listener is being installed. */
  private subscribe(release: () => void): void {
    if (this.phase === 'closed') {
      release()
    } else {
      this.releases.push(release)
    }
  }

  /** Send failures terminate correlation; they cannot establish whether a remote write happened. */
  private send(frame: RpcFrame): void {
    if (this.phase === 'closed') {
      return
    }
    try {
      this.options.transport.send(frame)
    } catch (cause) {
      this.disconnect(
        new RpcError('ConnectionClosed', 'The RPC frame could not be delivered.', { cause }),
      )
    }
  }

  /** Stop delivery once and release all subscriptions even when an adapter's cleanup fails. */
  private disconnect(reason: RpcError, rejection?: Extract<RpcFrame, { type: 'rejected' }>): void {
    if (this.phase === 'closed') {
      return
    }
    this.phase = 'closed'
    this.closeReason = reason
    clearTimeout(this.handshakeTimer)
    this.handshakeTimer = undefined
    this.rejectReady(reason)
    this.resolveClosed(reason)
    const cleanupErrors: unknown[] = []
    if (rejection) {
      try {
        this.options.transport.send(rejection)
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    for (const request of this.pending.values()) {
      request.release()
      request.reject(reason)
    }
    this.pending.clear()
    for (const controller of this.incoming.values()) {
      controller.abort(reason)
    }
    for (const release of this.releases.splice(0)) {
      try {
        release()
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      this.options.transport.close()
    } catch (error) {
      cleanupErrors.push(error)
    }
    for (const error of cleanupErrors) {
      this.options.reportError(error)
    }
  }

  private requireReady(): void {
    if (this.phase !== 'ready') {
      throw (
        this.closeReason ??
        new RpcError('ProtocolViolation', 'Await the RPC handshake before sending calls.')
      )
    }
  }
}

function own<Value>(
  table: Readonly<Record<string, Value>> | undefined,
  key: string,
): Value | undefined {
  return table && Object.hasOwn(table, key) ? table[key] : undefined
}

function deferred<Value>(): {
  promise: Promise<Value>
  resolve: (value: Value) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: Value) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<Value>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}
