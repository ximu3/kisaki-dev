/** @fileoverview Verifies strict frame parsing and lossless JSON transfer boundaries. */

import { describe, expect, it } from 'vitest'
import { parseRpcFrame } from './frames'
import { isJsonValue } from './json'

describe('transfer values', () => {
  it.each([
    undefined,
    NaN,
    Infinity,
    new Date(),
    new Map(),
    new Error(),
    [undefined],
    new Array<unknown>(2),
    { missing: undefined },
  ])('rejects values that are not ordinary JSON: %s', (value) => {
    expect(isJsonValue(value)).toBe(false)
  })

  it('rejects cycles, symbols, and nonenumerable members but permits repeated noncyclic values', () => {
    expect(
      isJsonValue({
        get value() {
          throw new Error('getter must not run')
        },
      }),
    ).toBe(false)
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    expect(isJsonValue(cyclic)).toBe(false)
    expect(isJsonValue({ [Symbol('secret')]: 1 })).toBe(false)
    expect(isJsonValue(Object.defineProperty({}, 'hidden', { value: 1 }))).toBe(false)
    const shared = { nested: [null, true, -3, 'text'] }
    expect(isJsonValue([shared, shared])).toBe(true)
  })
})

describe('RPC frames', () => {
  it.each([
    { type: 'hello', wireVersion: 1, protocol: { id: 'example', version: 1 }, context: null },
    { type: 'accepted', context: { instance: 'real' } },
    { type: 'rejected', error: { code: 'PermissionDenied', message: 'No access.' } },
    { type: 'request', id: 1, method: 'read', args: [] },
    { type: 'success', id: 1 },
    { type: 'success', id: 1, value: null },
    { type: 'failure', id: 1, error: { code: 'Conflict', message: 'Changed.' } },
    { type: 'notify', topic: 'changed', value: [] },
    { type: 'cancel', id: Number.MAX_SAFE_INTEGER },
  ])('accepts exactly the $type shape', (frame) => {
    expect(parseRpcFrame(frame)).toEqual(frame)
    expect(() => parseRpcFrame({ ...frame, extra: true })).toThrow(
      expect.objectContaining({ code: 'ProtocolViolation' }),
    )
  })

  it.each([
    { type: 'success', id: 0 },
    { type: 'success', id: 1, value: undefined },
    { type: 'cancel', id: 1.5 },
    { type: 'request', id: 1, method: 'read', args: {} },
    { type: 'hello', wireVersion: 1, protocol: { id: 'test', version: 1 } },
  ])('rejects malformed frames without normalization', (frame) => {
    expect(() => parseRpcFrame(frame)).toThrow(
      expect.objectContaining({ code: 'ProtocolViolation' }),
    )
  })

  it('rejects an unknown wire version before interpreting its unknown body', () => {
    expect(() =>
      parseRpcFrame({ type: 'hello', wireVersion: 2, unknownFutureBody: new Map() }),
    ).toThrow(expect.objectContaining({ code: 'ProtocolMismatch' }))
  })
})
