/** @fileoverview Reads strict JSON without duplicate decoded property names or lossy primitive values. */

import { visit } from 'jsonc-parser'
import { DesktopError } from './errors'
import { readRecord } from './validation'

/** Plain persisted desktop data. RPC frame values are independently owned by the environment-neutral transport package. */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

/** Validate and copy JSON data without dropping keys, allowing sparse arrays, invoking toJSON or accepting cycles. */
export function parseJsonValue(input: unknown): JsonValue {
  const holder: Record<string, JsonValue> = { value: null }

  type Container = Record<string, JsonValue> | JsonValue[]
  type Visit =
    | {
        readonly type: 'value'
        readonly input: unknown
        readonly target: Container
        readonly key: string | number
      }
    | { readonly type: 'leave'; readonly input: object }

  const pending: Visit[] = [{ type: 'value', input, target: holder, key: 'value' }]
  const ancestors = new Set<object>()

  function set(target: Container, key: string | number, value: JsonValue): void {
    ;(target as Record<string | number, JsonValue>)[key] = value
  }

  function invalid(): never {
    throw new DesktopError('InvalidInput', 'Expected a finite ordinary JSON value')
  }

  while (pending.length > 0) {
    const visit = pending.pop()!
    if (visit.type === 'leave') {
      ancestors.delete(visit.input)
      continue
    }

    const value = visit.input
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
      set(visit.target, visit.key, value)
      continue
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        invalid()
      }
      set(visit.target, visit.key, value === 0 ? 0 : value)
      continue
    }

    if (typeof value !== 'object' || ancestors.has(value)) {
      invalid()
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      invalid()
    }

    ancestors.add(value)
    pending.push({ type: 'leave', input: value })

    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) {
        invalid()
      }

      const output: JsonValue[] = new Array<JsonValue>(value.length)
      set(visit.target, visit.key, output)
      for (let index = value.length - 1; index >= 0; index -= 1) {
        if (!Object.hasOwn(value, index)) {
          invalid()
        }
        pending.push({ type: 'value', input: value[index], target: output, key: index })
      }
    } else {
      const entries = Object.entries(readRecord(value))
      if (Object.getOwnPropertyNames(value).length !== entries.length) {
        invalid()
      }

      const output: Record<string, JsonValue> = Object.fromEntries(
        entries.map(([key]) => [key, null]),
      )
      set(visit.target, visit.key, output)
      for (const [key, item] of entries.reverse()) {
        pending.push({ type: 'value', input: item, target: output, key })
      }
    }
  }

  return holder.value!
}

/** Parse a complete JSON document as unknown for its owning contract to validate; comments, BOM and duplicates fail. */
export function parseStrictJson(source: string): unknown {
  const objects: Set<string>[] = []

  function invalid(): never {
    throw new DesktopError('InvalidInput', 'Invalid strict JSON document')
  }

  if (source.startsWith('\ufeff')) {
    invalid()
  }

  visit(
    source,
    {
      onObjectBegin() {
        objects.push(new Set())
      },

      onObjectEnd() {
        objects.pop()
      },

      onObjectProperty(name) {
        const names = objects.at(-1)!
        if (names.has(name)) {
          invalid()
        }
        names.add(name)
      },

      onLiteralValue(value: unknown) {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          invalid()
        }
      },

      onError: invalid,
    },
    { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false },
  )

  return JSON.parse(source) as unknown
}
