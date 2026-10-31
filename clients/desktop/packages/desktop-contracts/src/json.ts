/** @fileoverview Defines standard JSON snapshots for persistent history and private values, without a transport dependency. */

import { ExecutionError } from './errors'
import { visit } from 'jsonc-parser'

/** A persistent JSON value. Optional members are omitted; runtime writes reject nonfinite numbers. */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

/** Check ordinary finite JSON without invoking accessors or accepting lossy serialization of local objects. */
export function isJsonValue(value: unknown): value is JsonValue {
  const ancestors = new Set<object>()
  function visit(current: unknown): boolean {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') {
      return true
    }
    if (typeof current === 'number') {
      return Number.isFinite(current)
    }
    if (typeof current !== 'object' || ancestors.has(current)) {
      return false
    }
    const array = Array.isArray(current)
    const prototype: unknown = Object.getPrototypeOf(current)
    if (!array && prototype !== Object.prototype && prototype !== null) {
      return false
    }
    ancestors.add(current)
    try {
      const keys = Reflect.ownKeys(current)
      if (array && keys.length !== current.length + 1) {
        return false
      }
      for (const key of keys) {
        if (array && key === 'length') {
          continue
        }
        if (
          typeof key !== 'string' ||
          (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length))
        ) {
          return false
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (!descriptor?.enumerable || !('value' in descriptor) || !visit(descriptor.value)) {
          return false
        }
      }
      return true
    } finally {
      ancestors.delete(current)
    }
  }
  try {
    return visit(value)
  } catch {
    return false
  }
}

/** Validate caller-owned JSON before private storage or persistent history, retaining its exact data semantics. */
export function parseJsonValue(input: unknown): JsonValue {
  if (!isJsonValue(input)) {
    throw new ExecutionError({
      code: 'InvalidInput',
      message: 'The value is not ordinary finite JSON.',
    })
  }
  return input
}

/** Parse strict, finite JSON without letting duplicate properties erase an earlier value. */
export function parseJsonDocument(text: string): JsonValue {
  const objects: Set<string>[] = []
  let invalid = false
  visit(
    text,
    {
      onObjectBegin: () => {
        objects.push(new Set())
      },
      onObjectProperty: (name) => {
        const current = objects.at(-1)
        if (!current || current.has(name)) {
          invalid = true
        }
        current?.add(name)
      },
      onObjectEnd: () => {
        objects.pop()
      },
      onError: () => {
        invalid = true
      },
    },
    { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false },
  )
  if (invalid) {
    throw new ExecutionError({
      code: 'InvalidInput',
      message: 'The document is not unambiguous JSON.',
    })
  }
  const value: unknown = JSON.parse(text)
  const pending = [value]
  while (pending.length > 0) {
    const current = pending.pop()
    if (typeof current === 'number' && !Number.isFinite(current)) {
      throw new ExecutionError({
        code: 'InvalidInput',
        message: 'The JSON document contains a nonfinite number.',
      })
    }
    if (current !== null && typeof current === 'object') {
      for (const child of Object.values(current)) {
        pending.push(child)
      }
    }
  }
  // JSON.parse establishes data-only structure; the traversal rejects its nonfinite numeric extension.
  return value as JsonValue
}

/** Decode stored JSON without changing its contents; nonfinite numeric input cannot become a legal snapshot. */
export function parseStoredJson(text: string): JsonValue {
  try {
    return parseJsonDocument(text)
  } catch (cause) {
    throw new ExecutionError(
      { code: 'DataIntegrityError', message: 'The stored JSON value is invalid.' },
      { cause },
    )
  }
}
