/** @fileoverview Exercises observable RPC behavior with paired, synchronous message channels. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { RpcConnection, type RpcConnectionOptions } from './connection'
import { RpcError } from './errors'
import type { MessageTransport } from './transport'

/** A channel fixture keeps message and close delivery synchronous to expose reentrancy bugs. */
function channels(): { left: MessageTransport; right: MessageTransport; listeners: () => number } {
  const messages = [
    new Set<(message: unknown) => void>(),
    new Set<(message: unknown) => void>(),
  ] as const
  const closures = [new Set<() => void>(), new Set<() => void>()] as const
  let closed = false
  function side(index: 0 | 1): MessageTransport {
    return {
      send(message) {
        if (closed) {
          throw new Error('closed fixture channel')
        }
        for (const listener of messages[index === 0 ? 1 : 0]) {
          listener(structuredClone(message))
        }
      },
      onMessage(listener) {
        messages[index].add(listener)
        return () => {
          messages[index].delete(listener)
        }
      },
      onClose(listener) {
        closures[index].add(listener)
        return () => {
          closures[index].delete(listener)
        }
      },
      close() {
        if (closed) {
          return
        }
        closed = true
        for (const listeners of closures) {
          for (const listener of [...listeners]) {
            listener()
          }
        }
      },
    }
  }
  return {
    left: side(0),
    right: side(1),
    listeners: () => messages[0].size + messages[1].size + closures[0].size + closures[1].size,
  }
}

const connections: RpcConnection[] = []
const protocol = { id: 'test.endpoint', version: 1 }

/** Establish both directions, retaining every connection for owned test cleanup. */
async function pair(
  left: Partial<RpcConnectionOptions> = {},
  right: Partial<RpcConnectionOptions> = {},
) {
  const transport = channels()
  const errors = vi.fn()
  const acceptor = new RpcConnection({
    protocol,
    transport: transport.right,
    reportError: errors,
    handshake: { role: 'acceptor', accept: () => ({ instance: 'bound' }) },
    ...right,
  })
  const initiator = new RpcConnection({
    protocol,
    transport: transport.left,
    reportError: errors,
    handshake: { role: 'initiator', context: null, validateAccepted: () => undefined },
    ...left,
  })
  connections.push(initiator, acceptor)
  await Promise.all([initiator.ready, acceptor.ready])
  return { initiator, acceptor, transport, errors }
}

afterEach(async () => {
  await Promise.all(connections.splice(0).map((connection) => connection.close()))
  vi.useRealTimers()
})

describe('RPC connection', () => {
  it('supports nested calls and equal IDs in opposite directions without serializing the pump', async () => {
    const result = await pair(
      { methods: { callback: async () => (await result.initiator.call('leaf', [])) ?? null } },
      {
        methods: {
          leaf: () => 'done',
          outer: async () => (await result.acceptor.call('callback', [])) ?? null,
        },
      },
    )

    await expect(result.initiator.call('outer', [])).resolves.toBe('done')
    expect(result.errors).not.toHaveBeenCalled()
  })

  it('distinguishes void from null and rejects unexposed prototype methods safely', async () => {
    const { initiator } = await pair({}, { methods: { empty: () => undefined, nil: () => null } })

    await expect(initiator.call('empty', [])).resolves.toBeUndefined()
    await expect(initiator.call('nil', [])).resolves.toBeNull()
    await expect(initiator.call('toString', [])).rejects.toMatchObject({ code: 'InvalidInput' })
    expect(initiator.state).toBe('ready')
  })

  it('does not complete cancellation before the handler has finished cleanup', async () => {
    let finish!: () => void
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const cleanup = new Promise<void>((resolve) => {
      finish = resolve
    })
    let handlerSignal: AbortSignal | undefined
    const { initiator } = await pair(
      {},
      {
        methods: {
          work: async (_, { signal }) => {
            handlerSignal = signal
            entered()
            await cleanup
            throw new RpcError('Cancelled', 'The operation was cancelled after cleanup.')
          },
        },
      },
    )
    const controller = new AbortController()
    const settled = vi.fn()
    const result = initiator.call('work', [], controller.signal).then(settled, (error: unknown) => {
      settled(error)
      return error
    })
    await started

    controller.abort()
    await Promise.resolve()
    expect(handlerSignal?.aborted).toBe(true)
    expect(settled).not.toHaveBeenCalled()
    finish()
    expect(await result).toMatchObject({ code: 'Cancelled' })
  })

  it('keeps a committed success when cancellation races its reply and never starts a pre-cancelled request', async () => {
    const controller = new AbortController()
    const handler = vi.fn(() => {
      controller.abort()
      return { committed: true }
    })
    const { initiator } = await pair({}, { methods: { commit: handler } })

    await expect(initiator.call('commit', [], controller.signal)).resolves.toEqual({
      committed: true,
    })
    await expect(initiator.call('commit', [], controller.signal)).rejects.toMatchObject({
      code: 'Cancelled',
    })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('retains endpoint-defined partial results and does not serialize arbitrary exception messages', async () => {
    const { initiator } = await pair(
      {},
      {
        methods: {
          fail: () => {
            throw new Error('secret path and credentials')
          },
        },
      },
    )
    await expect(initiator.call('fail', [])).rejects.toMatchObject({
      code: 'OperationFailed',
      message: 'The operation could not be completed.',
    })

    const { initiator: endpoint } = await pair(
      { parseError: (value) => Object.assign(new Error('Safe failure'), { summary: value }) },
      {
        serializeError: () => ({
          code: 'WriteFailed',
          message: 'Could not save.',
          partialResult: { saved: 3 },
        }),
        methods: {
          save: () => {
            throw new Error('storage error')
          },
        },
      },
    )
    await expect(endpoint.call('save', [])).rejects.toMatchObject({
      summary: { partialResult: { saved: 3 } },
    })
  })

  it('reports notification failures locally while other traffic continues', async () => {
    const reported = vi.fn()
    const { initiator } = await pair(
      {},
      {
        reportError: reported,
        notifications: {
          changed: () => {
            throw new Error('observer failed')
          },
        },
        methods: { read: () => 42 },
      },
    )

    initiator.notify('changed', null)
    await expect(initiator.call('read', [])).resolves.toBe(42)
    expect(reported).toHaveBeenCalledTimes(1)
  })

  it('rejects waiting calls, aborts local work, releases listeners, and discards late replies on closure', async () => {
    let release!: () => void
    let entered!: () => void
    let signal: AbortSignal | undefined
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const work = new Promise<void>((resolve) => {
      release = resolve
    })
    const { initiator, acceptor, transport } = await pair(
      {},
      {
        methods: {
          pending: async (_, context) => {
            signal = context.signal
            entered()
            await work
            return 'late'
          },
        },
      },
    )
    const result = initiator.call('pending', []).catch((error: unknown) => error)
    await started

    await initiator.close()
    expect(await result).toMatchObject({ code: 'ConnectionClosed' })
    expect(signal?.aborted).toBe(true)
    expect(transport.listeners()).toBe(0)
    const finished = vi.fn()
    const closure = acceptor.close().then(finished)
    await Promise.resolve()
    expect(finished).not.toHaveBeenCalled()
    release()
    await closure
    expect(finished).toHaveBeenCalledOnce()
  })

  it.each([
    { type: 'request', id: 1, method: 'read', args: [] },
    { type: 'success', id: 2, value: null },
    { type: 'mystery' },
    { type: 'notify', topic: 'unknown', value: null },
  ])('closes on an illegal post-handshake frame: $type', async (frame) => {
    const { initiator, acceptor, transport } = await pair({}, { methods: { read: () => null } })
    await initiator.call('read', [])

    if (frame.type === 'success') {
      transport.right.send(frame)
      expect(await initiator.closed).toMatchObject({ code: 'ProtocolViolation' })
    } else {
      transport.left.send(frame)
      expect(await acceptor.closed).toMatchObject({ code: 'ProtocolViolation' })
    }
  })

  it('ignores replies already delivered but rejects malformed business failures', async () => {
    const { initiator, transport } = await pair({}, { methods: { read: () => null } })
    await initiator.call('read', [])
    transport.right.send({ type: 'success', id: 1, value: 'late' })
    expect(initiator.state).toBe('ready')

    const pending = initiator.call('read', []).catch((error: unknown) => error)
    transport.right.send({ type: 'failure', id: 2, error: { internalStack: 'not a safe summary' } })
    expect(await pending).toMatchObject({ code: 'ProtocolViolation' })
  })

  it('rejects protocol mismatches before any method is available', async () => {
    const transport = channels()
    const server = new RpcConnection({
      protocol,
      transport: transport.right,
      reportError: vi.fn(),
      handshake: { role: 'acceptor', accept: () => null },
    })
    const serverReady = server.ready.catch((error: unknown) => error)
    const client = new RpcConnection({
      protocol: { ...protocol, version: 2 },
      transport: transport.left,
      reportError: vi.fn(),
      handshake: { role: 'initiator', context: null, validateAccepted: () => undefined },
    })
    connections.push(server, client)

    await expect(client.ready).rejects.toMatchObject({ code: 'ProtocolMismatch' })
    await serverReady
    expect(transport.listeners()).toBe(0)
  })

  it('limits only the handshake to ten seconds and forbids calls before acceptance', async () => {
    vi.useFakeTimers()
    const transport = channels()
    const client = new RpcConnection({
      protocol,
      transport: transport.left,
      reportError: vi.fn(),
      handshake: { role: 'initiator', context: null, validateAccepted: () => undefined },
    })
    connections.push(client)
    const ready = client.ready.catch((error: unknown) => error)

    await expect(client.call('read', [])).rejects.toMatchObject({ code: 'ProtocolViolation' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await ready).toMatchObject({ code: 'ConnectionClosed' })
    expect(transport.listeners()).toBe(0)
  })
})
