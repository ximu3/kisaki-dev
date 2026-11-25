import { DesktopError } from './errors'
import { parseRecord } from './validation'
import { visit } from 'jsonc-parser'

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

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
  const copies = new WeakMap<object, Container>()

  function set(target: Container, key: string | number, value: JsonValue): void {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    })
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
    const existing = copies.get(value)
    if (existing) {
      set(visit.target, visit.key, existing)
      continue
    }

    const keys = Reflect.ownKeys(value)
    let output: Container
    if (Array.isArray(value)) {
      if (keys.pop() !== 'length' || keys.length !== value.length) {
        invalid()
      }
      output = []
    } else {
      parseRecord(value)
      output = {}
    }

    copies.set(value, output)
    ancestors.add(value)
    set(visit.target, visit.key, output)
    pending.push({ type: 'leave', input: value })
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i]!
      const property = Object.getOwnPropertyDescriptor(value, key)!
      if (typeof key !== 'string' || !property.enumerable || !Object.hasOwn(property, 'value')) {
        invalid()
      }
      pending.push({ type: 'value', input: property.value, target: output, key })
    }
  }

  return holder.value!
}

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
