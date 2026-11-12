/** @fileoverview Reads ordinary finite JSON data before a transport can coerce or drop values. */

import { RpcError } from './errors'

/** Wire data shared by JSON IPC and structured-clone transports. */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

/** Snapshot own data properties, preserving shared subtrees as JSON and rejecting cycles. */
export function parseJsonValue(input: unknown): JsonValue {
  type Container = JsonValue[] | Record<string, JsonValue>
  const stack: { source: object; target: Container; keys: (string | symbol)[]; index: number }[] =
    []
  const ancestors = new Set<object>()
  const copies = new WeakMap<object, Container>()

  function invalid(): never {
    throw new RpcError('InvalidInput', 'Expected an ordinary finite JSON value')
  }

  function parseValue(value: unknown): JsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value === 0 ? 0 : value
    }
    if (typeof value !== 'object' || value === null || ancestors.has(value)) {
      return invalid()
    }

    // Structured clone can deliver a graph with shared children. Copy each distinct object once.
    const existing = copies.get(value)
    if (existing) {
      return existing
    }

    const keys = Reflect.ownKeys(value)
    let target: Container
    if (Array.isArray(value)) {
      // Array indices precede length. Extra properties and holes have no JSON representation.
      if (keys.pop() !== 'length' || keys.length !== value.length) {
        return invalid()
      }
      target = []
    } else {
      const prototype: unknown = Object.getPrototypeOf(value)
      if (prototype !== null && Object.getPrototypeOf(prototype) !== null) {
        return invalid()
      }
      target = {}
    }

    ancestors.add(value)
    copies.set(value, target)
    stack.push({ source: value, target, keys, index: 0 })
    return target
  }

  const root = parseValue(input)
  while (stack.length > 0) {
    const item = stack[stack.length - 1]!
    if (item.index === item.keys.length) {
      ancestors.delete(item.source)
      stack.pop()
      continue
    }

    const key = item.keys[item.index++]!
    const property = Object.getOwnPropertyDescriptor(item.source, key)!
    if (typeof key !== 'string' || !property.enumerable || !Object.hasOwn(property, 'value')) {
      return invalid()
    }

    // Define even "__proto__" as an own data property without invoking an inherited setter.
    Object.defineProperty(item.target, key, {
      value: parseValue(property.value),
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }

  return root
}
