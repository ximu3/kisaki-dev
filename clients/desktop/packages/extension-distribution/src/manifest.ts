/** @fileoverview Defines and parses immutable extension package manifests and runtime declarations. */

import * as v from 'valibot'
import { objectSchema } from './schema'
import { extensionIdSchema, packagePathSchema } from './identity'
import {
  localizedTextSchema,
  parseLanguageTag,
  parseLocalizedText,
  type LocalizedText,
} from './metadata'
import {
  parseFormat,
  parseHttpUrl,
  textSchema,
  versionRangeSchema,
  versionSchema,
} from './validation'

/** Document-format version; it is independent of extension versions and runtime API versions. */
export const manifestSchemaVersion = 1
/** Supported process targets, not a claim that any particular artifact has passed platform testing. */
export const extensionTargets = [
  'windows-x64',
  'windows-arm64',
  'macos-x64',
  'macos-arm64',
  'linux-x64',
  'linux-arm64',
] as const
/** Current writable purpose labels; readers retain unfamiliar labels without granting capabilities. */
export const extensionCategories = ['metadata', 'integration', 'theme', 'tool', 'language'] as const
export type ExtensionTarget = (typeof extensionTargets)[number]
export type ExtensionCategory = (typeof extensionCategories)[number]

/** Static author display information. URLs and email addresses never establish trust. */
export interface ExtensionAuthor {
  readonly name: string
  readonly url?: string
  readonly email?: string
}

/** Runtime conditions attached to one concrete package or artifact. */
export interface ExtensionRequirements {
  readonly targets: readonly ExtensionTarget[]
  readonly apiVersionRange: string
  readonly nodeVersionRange?: string
  readonly electronVersionRange?: string
}

/** Complete immutable package metadata; entry and resources are relative to the package root. */
export interface ExtensionManifest extends ExtensionRequirements {
  readonly schemaVersion: 1
  readonly id: string
  readonly version: string
  readonly entry: string
  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly categories?: readonly string[]
  readonly keywords?: readonly string[]
  readonly icon?: string
  readonly readme?: string
  readonly author?: ExtensionAuthor
  readonly license?: string
  readonly homepage?: string
  readonly repository?: string
  readonly issues?: string
}

const httpUrlSchema = v.pipe(
  textSchema,
  v.check((value) => {
    try {
      parseHttpUrl(value)
      return true
    } catch {
      return false
    }
  }),
)
export const authorSchema = objectSchema({
  name: textSchema,
  url: v.exactOptional(httpUrlSchema),
  email: v.exactOptional(v.pipe(v.string(), v.email())),
})
export const targetsSchema = v.pipe(
  v.array(v.picklist(extensionTargets)),
  v.minLength(1),
  v.check((values) => new Set(values).size === values.length),
)
export const requirementEntries = {
  targets: targetsSchema,
  apiVersionRange: versionRangeSchema,
  nodeVersionRange: v.exactOptional(versionRangeSchema),
  electronVersionRange: v.exactOptional(versionRangeSchema),
}
export const displayEntries = {
  defaultLocale: textSchema,
  name: localizedTextSchema,
  description: v.exactOptional(localizedTextSchema),
  categories: v.exactOptional(v.array(textSchema)),
  keywords: v.exactOptional(v.array(textSchema)),
  author: v.exactOptional(authorSchema),
  homepage: v.exactOptional(httpUrlSchema),
  repository: v.exactOptional(httpUrlSchema),
  issues: v.exactOptional(httpUrlSchema),
}
const manifestSchema = objectSchema({
  schemaVersion: v.literal(manifestSchemaVersion),
  id: extensionIdSchema,
  version: versionSchema,
  ...requirementEntries,
  ...displayEntries,
  entry: packagePathSchema,
  icon: v.exactOptional(packagePathSchema),
  readme: v.exactOptional(packagePathSchema),
  license: v.exactOptional(textSchema),
})

/** Read a manifest, retaining unknown purpose labels and normalizing only the declared language values. */
export function parseExtensionManifest(input: unknown): ExtensionManifest {
  return normalizeDisplay(parseFormat(manifestSchema, input, 'extension manifest'))
}

/** Validate a newly authored manifest; only current purpose labels may be written. */
export function validateExtensionManifest(input: unknown): ExtensionManifest {
  const manifest = parseExtensionManifest(input)
  if (manifest.categories) {
    parseFormat(
      v.pipe(
        v.array(v.picklist(extensionCategories)),
        v.check((values) => new Set(values).size === values.length),
      ),
      manifest.categories,
      'extension categories',
    )
  }
  return manifest
}

/** Normalize shared display metadata after any required verification of the original document. */
export function normalizeDisplay<
  Value extends {
    readonly defaultLocale: string
    readonly name: LocalizedText
    readonly description?: LocalizedText
  },
>(value: Value): Value {
  const defaultLocale = parseLanguageTag(value.defaultLocale)
  const name = parseLocalizedText(value.name, defaultLocale)
  parseFormat(
    v.pipe(
      localizedTextSchema,
      v.check((text) =>
        typeof text === 'string'
          ? text.trim().length > 0
          : Object.values(text).every((item) => item.trim().length > 0),
      ),
    ),
    name,
    'display name',
  )
  return {
    ...value,
    defaultLocale,
    name,
    ...(value.description === undefined
      ? {}
      : { description: parseLocalizedText(value.description, defaultLocale) }),
  }
}
