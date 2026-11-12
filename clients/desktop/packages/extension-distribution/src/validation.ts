/** @fileoverview Reads strict JSON and supplies the shared field checks used by distribution formats. */

import { visit } from 'jsonc-parser'
import { DistributionError } from './errors'
import type { FieldPath } from './errors'

/** JSON values retain unknown fields so signatures cover the complete document. */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** Reject a field with a stable format category and a path into the original input. */
export function rejectFormat(path: FieldPath, message: string): never {
  throw new DistributionError('invalid-format', message, path)
}

/** Read strict JSON, rejecting duplicate decoded names, nonfinite numbers and invalid Unicode. */
export function parseJson(text: string): JsonValue {
  const objects: Set<string>[] = []
  visit(
    text,
    {
      onObjectBegin() {
        objects.push(new Set())
      },
      onObjectEnd() {
        objects.pop()
      },
      onObjectProperty(name, _offset, _length, _line, _character, path) {
        parseString(name, [...path(), name], false)
        const names = objects.at(-1)!
        if (names.has(name)) {
          throw new DistributionError('duplicate-property', 'Duplicate JSON property', [
            ...path(),
            name,
          ])
        }
        names.add(name)
      },
      onLiteralValue(value: unknown, _offset, _length, _line, _character, path) {
        if (typeof value === 'string') {
          parseString(value, path(), false)
        } else if (typeof value === 'number' && !Number.isFinite(value)) {
          rejectFormat(path(), 'Expected a finite JSON number')
        }
      },
      onError(_error, _offset, _length, line, character) {
        throw new DistributionError(
          'invalid-json',
          `Invalid JSON syntax at line ${line + 1}, column ${character + 1}`,
        )
      },
    },
    { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false },
  )

  // The strict visitor has checked syntax, duplicate keys and every JCS primitive before parsing.
  return JSON.parse(text) as JsonValue
}

/** Require an object at a format boundary; arrays and null are not records. */
export function parseRecord(value: unknown, path: FieldPath): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    rejectFormat(path, 'Expected an object')
  }

  return value as Record<string, unknown>
}

/** Require a string, preserving its exact content rather than trimming user text. */
export function parseString(value: unknown, path: FieldPath, nonempty = true): string {
  if (
    typeof value !== 'string' ||
    /[\uD800-\uDFFF]/u.test(value) ||
    (nonempty && value.trim().length === 0)
  ) {
    rejectFormat(path, 'Expected a valid string')
  }

  return value
}

/** Require an array and validate every position, including empty slots, at its original field location. */
export function parseArray<T>(
  value: unknown,
  path: FieldPath,
  parse: (value: unknown, path: FieldPath) => T,
): T[] {
  if (!Array.isArray(value)) {
    rejectFormat(path, 'Expected an array')
  }
  return Array.from(value, (item: unknown, index) => parse(item, [...path, index]))
}

/** Parse a present optional property; explicit null and undefined are not omissions. */
export function parseOptionalField<K extends string, T>(
  object: Record<string, unknown>,
  key: K,
  path: FieldPath,
  parse: (value: unknown, path: FieldPath) => T,
): Partial<Record<K, T>> {
  const result: Partial<Record<K, T>> = {}
  if (Object.hasOwn(object, key)) {
    result[key] = parse(object[key], [...path, key])
  }
  return result
}

/** Require the format version implemented by this package. */
export function parseSchemaVersion(value: unknown, path: FieldPath): 1 {
  if (value !== 1) {
    throw new DistributionError(
      'unsupported-schema',
      'Unsupported distribution schema version',
      path,
    )
  }

  return 1
}

/** Parse a nonnegative byte count without loss of precision. */
export function parseUnsignedInteger(value: unknown, path: FieldPath): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    rejectFormat(path, 'Expected a nonnegative safe integer')
  }

  return value
}

/** Parse UTC epoch milliseconds that can be represented and displayed as an actual time point. */
export function parseTimestamp(value: unknown, path: FieldPath): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    Number.isNaN(new Date(value).getTime())
  ) {
    rejectFormat(path, 'Expected a valid UTC millisecond timestamp')
  }

  return value
}

/** Require a lowercase SHA-256 hexadecimal digest. */
export function parseSha256(value: unknown, path: FieldPath): string {
  const digest = parseString(value, path)
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    rejectFormat(path, 'Expected a lowercase SHA-256 digest')
  }

  return digest
}
