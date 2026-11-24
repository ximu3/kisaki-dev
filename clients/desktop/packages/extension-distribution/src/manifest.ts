import { parseCompatibility, parseVersion, type CompatibilityDeclaration } from './compatibility'
import type { FieldPath } from './errors'
import { parseId, parseMetadata, type ExtensionMetadata } from './metadata'
import {
  rejectFormat,
  parseOptionalField,
  parseJson,
  parseRecord,
  parseSchemaVersion,
  parseString,
} from './validation'

export const manifestSchemaVersion = 1

export interface ExtensionManifest extends ExtensionMetadata, CompatibilityDeclaration {
  readonly schemaVersion: typeof manifestSchemaVersion
  readonly id: string
  readonly version: string

  readonly entry: string
  readonly icon?: string
  readonly readme?: string

  readonly license?: string
}

export function parsePackagePath(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  const segments = value.split('/')
  if (
    /(?=\p{ASCII})\p{Control}/u.test(value) ||
    /[\\:]/.test(value) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    rejectFormat(path, 'Expected an unambiguous package-relative file path')
  }

  return value
}

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

export function parseManifest(text: string): ExtensionManifest {
  return normalizeManifest(parseJson(text))
}
