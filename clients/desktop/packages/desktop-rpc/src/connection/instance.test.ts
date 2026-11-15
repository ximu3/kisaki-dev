/** @fileoverview Drives the public message pump through handshake, concurrent calls, cancellation and channel loss. */

import { expect, onTestFinished, test, vi } from 'vite-plus/test'
import { RpcConnection } from './instance'
import type { RpcEndpoint } from './endpoint'
import { RpcError } from '../errors'
import type { RpcFrame } from '../frames'
import type { RpcTransport } from '../transport'

/** Synthetic application protocol identity shared by the connection cases. */
const protocol = { id: 'fixture', version: 1 }

/** Valid initiating frame used to exercise handshake state transitions. */
const hello = { type: 'hello', wireVersion: 1, protocol, context: 'client' }

/** Synthetic accepting endpoint with a stable server handshake context. */
const acceptor: RpcEndpoint = {
  protocol,
  handshake: {
    role: 'acceptor',
    /** Accepts fixture peers and returns the synthetic server context. */
    accept: () => 'server',
  },
}

/** Creates an RPC connection with a controllable transport and automatic test cleanup. */
function fixture(endpoint: RpcEndpoint = acceptor) {
  /** Delivers a test-controlled frame through the connection's actual transport subscription. */
  let receive!: (frame: unknown) => void
  /** Notifies the connection that the controlled transport has been lost. */
  let lost!: () => void
  const transport = {
    /** Captures receive and close callbacks for test-controlled transport delivery. */
    start(message, closed) {
      receive = message
      lost = closed
    },
    /** Records frames handed to the controlled transport. */
    send: vi.fn<(frame: RpcFrame) => void>(),
    /** Records release of the controlled transport. */
    close: vi.fn<() => void>(),
  } satisfies RpcTransport
  const rpc = new RpcConnection(transport, endpoint)
  onTestFinished(() => rpc.close())

  return { rpc, receive, lost, transport }
}

test('a bound acceptor rejects a different wire, endpoint version or unauthorized context exactly once', async () => {
  /** Handshake callback that denies the synthetic peer with a safe permission failure. */
  const accept = vi.fn(() => {
    throw new RpcError('PermissionDenied', 'Peer denied')
  })
  for (const [frame, code] of [
    [
      {
        type: 'hello',
        wireVersion: 9,
        /** Fails if the receiver inspects context from a foreign wire version. */
        get context() {
          throw new Error('foreign version')
        },
      },
      'ProtocolMismatch',
    ],
    [{ ...hello, protocol: { ...protocol, version: 2 } }, 'ProtocolMismatch'],
    [hello, 'PermissionDenied'],
  ] as const) {
    /** Synthetic rejecting connection and its frame-delivery and transport controls. */
    const { rpc, receive, transport } = fixture({
      protocol,
      handshake: { role: 'acceptor', accept },
    })

    receive(frame)
    receive(hello)

    await expect(rpc.ready).rejects.toMatchObject({ code })
    expect(transport.send).toHaveBeenCalledOnce()
    expect(transport.send.mock.calls[0]?.[0]).toMatchObject({
      type: 'rejected',
      error: { code },
    })
    expect(transport.close).toHaveBeenCalledOnce()
  }
  expect(accept).toHaveBeenCalledExactlyOnceWith('client')
})

test('the initiator waits for a valid acceptance and preserves a safe rejection', async () => {
  /** Handshake callback that rejects a mismatched synthetic instance. */
  const accepts = vi.fn(() => {
    throw new RpcError('InstanceExpired', 'Wrong peer')
  })
  const endpoint: RpcEndpoint = {
    protocol,
    handshake: { role: 'initiator', context: 'client', accepts },
  }
  const first = fixture(endpoint)
  expect(first.transport.send).toHaveBeenCalledExactlyOnceWith(hello)
  await expect(first.rpc.request('early')).rejects.toMatchObject({ code: 'ProtocolViolation' })
  expect(() => first.rpc.notify('early', null)).toThrow()
  first.receive({ type: 'accepted', context: 'stale' })
  await expect(first.rpc.ready).rejects.toMatchObject({ code: 'InstanceExpired' })

  const second = fixture(endpoint)
  second.receive({ type: 'rejected', error: { code: 'PermissionDenied', message: 'Denied' } })
  await expect(second.rpc.ready).rejects.toMatchObject({
    code: 'PermissionDenied',
    message: 'Denied',
  })
  expect(accepts).toHaveBeenCalledExactlyOnceWith('stale')
})

test('a silent peer has ten seconds to handshake and an early request closes immediately', async () => {
  vi.useFakeTimers()
  try {
    const waiting = fixture()
    vi.advanceTimersByTime(10_000)
    await expect(waiting.rpc.ready).rejects.toMatchObject({ code: 'ConnectionClosed' })
    expect(waiting.transport.close).toHaveBeenCalledOnce()

    const early = fixture()
    early.receive({ type: 'request', id: 1, method: 'early', args: [] })
    await expect(early.rpc.ready).rejects.toMatchObject({ code: 'ProtocolViolation' })
    expect(early.transport.send).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})

test('a nested call can use the same ID in the other direction and completed replies have no effect', async () => {
  /** Synthetic connection exercising reverse calls while a remote method remains active. */
  const { rpc, receive, transport } = fixture({
    ...acceptor,
    methods: {
      /** Calls back through the same connection while the incoming request remains active. */
      nested: () => rpc.request('callback'),
    },
  })
  receive(hello)
  await expect(rpc.ready).resolves.toBe('client')

  receive({ type: 'request', id: 1, method: 'nested', args: [] })
  expect(transport.send).toHaveBeenLastCalledWith({
    type: 'request',
    id: 1,
    method: 'callback',
    args: [],
  })
  receive({ type: 'success', id: 1, value: null })
  receive({ type: 'failure', id: 1, error: 'late' })
  await vi.waitFor(() =>
    expect(transport.send).toHaveBeenLastCalledWith({ type: 'success', id: 1, value: null }),
  )
  expect(transport.send).toHaveBeenCalledTimes(3)

  const result = rpc.request('no-result')
  receive({ type: 'success', id: 2 })
  await expect(result).resolves.toBeUndefined()
})

test('abort requests the remote outcome and never retroactively changes completed calls', async () => {
  /** Synthetic connection and controls used to verify transport-owned request lifetime. */
  const { rpc, receive, transport } = fixture()
  receive(hello)
  await rpc.ready

  const controller = new AbortController()
  const result = rpc.request('commit', [], { signal: controller.signal })

  controller.abort()
  expect(transport.send).toHaveBeenLastCalledWith({ type: 'cancel', id: 1 })
  receive({ type: 'success', id: 1, value: 'committed' })
  await expect(result).resolves.toBe('committed')

  const next = new AbortController()
  const completed = rpc.request('commit', [], { signal: next.signal })
  receive({ type: 'success', id: 2 })
  await completed

  next.abort()
  await expect(rpc.request('never sent', [], { signal: next.signal })).rejects.toMatchObject({
    code: 'Cancelled',
  })
  expect(transport.send).toHaveBeenCalledTimes(4)
})

test('only own methods execute, exceptions stay local and notification failures have no reply', async () => {
  /** Observer-error spy used to verify notification failures remain outside request results. */
  const onError = vi.fn()
  /** Synthetic endpoint separating private method failures from notification observer failures. */
  const { rpc, receive, transport } = fixture({
    ...acceptor,
    methods: {
      /** Throws a private failure to verify the default codec does not expose its message. */
      broken: () => {
        throw new Error('private message')
      },
    },
    notifications: {
      topics: {
        /** Rejects notification delivery so the observer-error owner can report it independently. */
        changed: () => Promise.reject(new Error('observer failed')),
      },
      onError,
    },
  })
  receive(hello)
  await rpc.ready

  receive({ type: 'request', id: 1, method: 'toString', args: [] })
  receive({ type: 'request', id: 2, method: 'broken', args: [] })
  receive({ type: 'notify', topic: 'changed', value: null })
  await vi.waitFor(() =>
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), 'changed'),
  )
  expect(transport.send.mock.calls.map(([frame]) => frame).slice(1)).toEqual([
    { type: 'failure', id: 1, error: { code: 'InvalidInput', message: 'Unknown RPC method' } },
    { type: 'failure', id: 2, error: { code: 'OperationFailed', message: 'The operation failed' } },
  ])
})

test('endpoint codecs receive the method and deliver its safe partial result', async () => {
  const failure = new Error('local diagnostic')
  const partial = { code: 'Interrupted', message: 'Stopped', partialResult: [1] }
  const restored = Object.assign(new RpcError(partial.code, partial.message), {
    partialResult: [1],
  })
  /** Error encoder spy returning the fixture's explicit partial result. */
  const encode = vi.fn(() => partial)
  /** Error decoder spy restoring the fixture's domain failure. */
  const decode = vi.fn(() => restored)
  /** Synthetic connection using the explicitly supplied domain error codec. */
  const { rpc, receive, transport } = fixture({
    ...acceptor,
    methods: {
      /**
       * Throws the fixture domain failure so the configured error codec owns its wire
       * representation.
       */
      edit() {
        throw failure
      },
    },
    errors: { encode, decode },
  })
  receive(hello)
  await rpc.ready

  const pending = rpc.request('edit')
  receive({ type: 'request', id: 1, method: 'edit', args: [] })
  const reply = transport.send.mock.lastCall?.[0]

  expect(reply).toEqual({ type: 'failure', id: 1, error: partial })
  receive(reply)
  await expect(pending).rejects.toBe(restored)
  expect(encode).toHaveBeenCalledExactlyOnceWith(failure, 'edit')
  expect(decode).toHaveBeenCalledExactlyOnceWith(partial, 'edit')
})

test('correlation violations close the connection and terminate outstanding waits', async () => {
  const request = { type: 'request', id: 3, method: 'read', args: [] }
  for (const invalid of [
    request,
    { ...request, id: 2 },
    { type: 'success', id: 2 },
    { type: 'new-frame' },
  ]) {
    /** Synthetic connection and receive callback used to exercise terminal connection handling. */
    const { rpc, receive } = fixture()
    receive(hello)
    await rpc.ready
    const pending = rpc.request('pending')
    receive(request)
    receive(invalid)
    await expect(rpc.closed).resolves.toMatchObject({ code: 'ProtocolViolation' })
    await expect(pending).rejects.toMatchObject({ code: 'ConnectionClosed' })
  }
})

test('disconnect releases both directions; late work and old callbacks cannot settle a new connection', async () => {
  /** Completes the old method after disconnection to verify that late work stays isolated. */
  let finish!: () => void
  let executing!: AbortSignal
  const old = fixture({
    ...acceptor,
    methods: {
      /** Captures the method cancellation signal and leaves completion under test control. */
      work: (_args, signal) => {
        executing = signal
        return new Promise<void>((resolve) => {
          finish = resolve
        })
      },
    },
  })
  old.receive(hello)
  await old.rpc.ready

  const pending = old.rpc.request('unconfirmed')
  old.receive({ type: 'request', id: 1, method: 'work', args: [] })
  old.lost()
  old.rpc.close()

  await expect(pending).rejects.toMatchObject({ code: 'ConnectionClosed' })
  expect(executing.aborted).toBe(true)
  expect(old.transport.close).toHaveBeenCalledOnce()

  const next = fixture()
  next.receive(hello)
  await next.rpc.ready

  const fresh = next.rpc.request('read')
  old.receive({ type: 'success', id: 1, value: 'old' })
  finish()
  next.receive({ type: 'success', id: 1, value: 'new' })

  await expect(fresh).resolves.toBe('new')
  expect(old.transport.send).toHaveBeenCalledTimes(2)
})
