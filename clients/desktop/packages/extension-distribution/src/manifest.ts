/** @fileoverview Parses complete package manifests and validates package-relative file references. */

import type { CompatibilityDeclaration } from './compatibility'
import { parseCompatibility, parseVersion } from './compatibility'
import type { FieldPath } from './errors'
import type { ExtensionMetadata } from './metadata'
import { parseId, parseMetadata } from './metadata'
import {
  rejectFormat,
  parseOptionalField,
  parseJson,
  parseRecord,
  parseSchemaVersion,
  parseString,
} from './validation'

/** The manifest format version implemented by this package, independent of extension API versions. */
export const manifestSchemaVersion = 1

/** Complete package facts; the package is independent of any registry, URL or signature. */
export interface ExtensionManifest extends ExtensionMetadata, CompatibilityDeclaration {
  readonly schemaVersion: typeof manifestSchemaVersion
  readonly id: string
  readonly version: string

  /** Built ESM entry relative to the package root. Existence and module loading belong to the consumer. */
  readonly entry: string
  readonly icon?: string
  readonly readme?: string

  readonly license?: string
}

/**
 * Require a slash-separated relative file path without root escapes, drive prefixes or alternate streams.
 * This checks names only; archive readers must also reject links, collisions and non-file entries.
 */
export function parsePackagePath(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  const segments = value.split('/')
  if (
    [...value].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    /[\\:]/.test(value) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    rejectFormat(path, 'Expected an unambiguous package-relative file path')
  }

  return value
}

/** Validate defined manifest fields and return normalized locales and target order; unknown fields are omitted. */
export function normalizeManifest(input: unknown): ExtensionManifest {
  const value = parseRecord(input, [])

  return {
    schemaVersion: parseSchemaVersion(value.schemaVersion, ['schemaVersion']),
    id: parseId(value.id, ['id']),
    version: parseVersion(value.version, ['version']),

    ...parseCompatibility(value),
    ...parseMetadata(value, []),

    entry: parsePackagePath(value.entry, ['entry']),
    ...parseOptionalField(value, 'icon', [], parsePackagePath),
    ...parseOptionalField(value, 'readme', [], parsePackagePath),
    ...parseOptionalField(value, 'license', [], parseString),
  }
}

/** Parse strict JSON before normalizing the manifest; duplicate properties are rejected at every depth. */
export function parseManifest(text: string): ExtensionManifest {
  return normalizeManifest(parseJson(text))
}
