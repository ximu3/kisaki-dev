/** @fileoverview Reads strict JSON and supplies the shared field checks used by distribution formats. */

import { visit } from 'jsonc-parser'
import { DistributionError } from './errors'
import type { FieldPath } from './errors'

/**
 * JSON data retained from the complete distribution document, including fields used only by
 * signing.
 */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

/** Throws invalid-format at the supplied document field path. */
export function rejectFormat(path: FieldPath, message: string): never {
  throw new DistributionError('invalid-format', message, path)
}

/**
 * Parses strict JSON with unique decoded property names and finite, well-formed values.
 *
 * Rejects comments, trailing commas, duplicate keys and unpaired surrogate code units. Unknown
 * fields remain available for canonical signing.
 */
export function parseJson(text: string): JsonValue {
  const objects: Set<string>[] = []
  visit(
    text,
    {
      /** Starts property-name tracking for the next registry or manifest object. */
      onObjectBegin() {
        objects.push(new Set())
      },
      /** Releases property-name tracking when the current object ends. */
      onObjectEnd() {
        objects.pop()
      },
      /** Validates scalar property names and rejects duplicates with their exact input path. */
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
      /** Validates scalar string content and finite numeric values before normalization. */
      onLiteralValue(value: unknown, _offset, _length, _line, _character, path) {
        if (typeof value === 'string') {
          parseString(value, path(), false)
        } else if (typeof value === 'number' && !Number.isFinite(value)) {
          rejectFormat(path(), 'Expected a finite JSON number')
        }
      },
      /** Reports invalid JSON syntax using the parser's one-based source location. */
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

/** Accepts a non-null, non-array object for field parsing. */
export function parseRecord(value: unknown, path: FieldPath): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    rejectFormat(path, 'Expected an object')
  }

  return value as Record<string, unknown>
}

/**
 * Parses a well-formed Unicode string while preserving its exact contents.
 *
 * The default requires nonblank text; nonempty=false also accepts empty or whitespace-only strings.
 */
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

/** Parses every array position, including holes, using its original indexed field path. */
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

/**
 * Parses an own property when present and returns an object containing that field.
 *
 * Absent properties produce an empty object. Explicit null and undefined values go through the
 * supplied parser.
 */
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

/** Accepts distribution schema version 1 and reports unsupported-schema for other values. */
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

/** Parses a nonnegative safe-integer byte count. */
export function parseUnsignedInteger(value: unknown, path: FieldPath): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    rejectFormat(path, 'Expected a nonnegative safe integer')
  }

  return value
}

/** Parses UTC epoch milliseconds as a safe integer within JavaScript's Date range. */
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

/** Parses a 64-character lowercase SHA-256 hexadecimal digest. */
export function parseSha256(value: unknown, path: FieldPath): string {
  const digest = parseString(value, path)
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    rejectFormat(path, 'Expected a lowercase SHA-256 digest')
  }

  return digest
}
