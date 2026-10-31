/** @fileoverview Validates the ordinary JSON values carried by RPC messages. */

/** A transferable value; omitted object fields and void results are represented separately. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject

/** Named JSON members; values cannot be undefined, accessors, or local resources. */
export interface JsonObject {
  readonly [key: string]: JsonValue
}

/** Check JSON semantics without invoking getters or accepting lossy serialization. */
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
        if (typeof key !== 'string') {
          return false
        }
        if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length)) {
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
    // Proxies and excessive recursion are not usable transfer values.
    return false
  }
}
