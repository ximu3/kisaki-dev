/** @fileoverview Exercises the shared JSON boundary and the exact shapes of wire-version-one messages. */

import { expect, test } from 'vitest'
import { parseRpcFrame, type RpcFrame } from './frames'
import { parseJsonValue } from './json'

test('all frame kinds round-trip, including omitted success values and explicit null', () => {
  const frames: RpcFrame[] = [
    { type: 'hello', wireVersion: 1, protocol: { id: 'test', version: 2 }, context: {} },
    { type: 'accepted', context: null },
    { type: 'rejected', error: { code: 'Denied', message: 'Access denied' } },
    { type: 'request', id: 1, method: 'read', args: [null, { data: ['a', true] }] },
    { type: 'success', id: 1 },
    { type: 'success', id: 2, value: null },
    { type: 'failure', id: 2, error: ['partial', 3] },
    { type: 'notify', topic: 'changed', value: false },
    { type: 'cancel', id: 3 },
  ]
  for (const frame of frames) {
    expect(parseRpcFrame(frame)).toStrictEqual(frame)
  }
})

test('malformed envelopes and data that a native transport would coerce are rejected', () => {
  const cycle: unknown[] = []
  cycle.push(cycle)
  const accessor = Object.defineProperty({}, 'secret', {
    enumerable: true,
    get() {
      throw new Error('getter ran')
    },
  })
  for (const value of [
    undefined,
    NaN,
    Infinity,
    () => 1,
    1n,
    new Date(),
    new Map(),
    new Error(),
    new AbortController().signal,
    Array(1),
    [undefined],
    { optional: undefined },
    { [Symbol()]: true },
    accessor,
    cycle,
  ]) {
    expect(() => parseJsonValue(value)).toThrowError(
      expect.objectContaining({ code: 'InvalidInput' }),
    )
  }

  for (const frame of [
    { type: 'unknown' },
    { type: 'success', id: 0 },
    { type: 'success', id: 1, value: undefined },
    { type: 'failure', id: 1 },
    { type: 'request', id: 1.5, method: 'a', args: [] },
    { type: 'cancel', id: Number.MAX_SAFE_INTEGER + 1 },
    { type: 'cancel', id: 1, extra: true },
    { type: 'rejected', error: { code: 'Denied', message: 'Denied', stack: 'private' } },
    {
      type: 'hello',
      wireVersion: 1,
      protocol: { id: 'fixture', version: 1, extra: 3 },
      context: null,
    },
  ]) {
    expect(() => parseRpcFrame(frame)).toThrowError(
      expect.objectContaining({ code: 'ProtocolViolation' }),
    )
  }
})

test('JSON snapshots preserve own data keys and repeated subtrees independently', () => {
  const item = { ['__proto__']: { count: 1 } }
  const snapshot = parseJsonValue([item, item])
  item.__proto__.count++
  expect(snapshot).toStrictEqual([{ ['__proto__']: { count: 1 } }, { ['__proto__']: { count: 1 } }])
})
