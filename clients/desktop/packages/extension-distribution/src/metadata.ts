/** @fileoverview Defines extension identity, static display text and deterministic locale matching. */

import { match } from '@formatjs/intl-localematcher'
import { DistributionError } from './errors'
import type { FieldPath } from './errors'
import { array, invalid, optional, record, string } from './validation'

/** Literal text or translations keyed by canonical Unicode locale identifiers. */
export type LocalizedText = string | Readonly<Record<string, string>>

/** Known display categories. Unknown categories remain valid and have no capability meaning. */
export const extensionCategories = Object.freeze([
  'metadata',
  'integration',
  'theme',
  'tool',
  'language',
] as const)

/** Categories accepted for newly authored values; readers retain unknown category strings. */
export type ExtensionCategory = (typeof extensionCategories)[number]

/** Validate a newly authored category. Existing manifests and registry listings use tolerant string reads. */
export function parseCategory(input: unknown, path: FieldPath = []): ExtensionCategory {
  const value = string(input, path)
  const category = extensionCategories.find((known) => known === value)
  if (category === undefined) {
    invalid(path, 'Unknown category for a new declaration')
  }
  return category
}

/** An author's displayed name and optional contact address; this does not establish identity. */
export interface ExtensionAuthor {
  readonly name: string
  readonly url?: string
}

/** Static display fields shared by manifests and current registry listings. */
export interface ExtensionMetadata {
  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description?: LocalizedText

  readonly categories?: readonly string[]
  readonly keywords?: readonly string[]

  readonly author?: ExtensionAuthor
  readonly homepage?: string
  readonly repository?: string
  readonly issues?: string
}

/** Validate a complete opaque ID; dots delimit syntax only, never ownership or permissions. */
export function parseId(input: unknown, path: FieldPath = []): string {
  const value = string(input, path)
  // Compare the whole match: JavaScript's $ can also match before a final line terminator.
  if (
    /^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]*[a-z0-9])?)*$/.exec(value)?.[0] !== value
  ) {
    invalid(path, 'Invalid extension or registry ID')
  }
  return value
}

/** Canonicalize a locale using the host Intl implementation; invalid tags are format errors. */
export function normalizeLocale(input: unknown, path: FieldPath = []): string {
  const locale = string(input, path)
  try {
    return Intl.getCanonicalLocales(locale)[0]!
  } catch (cause) {
    throw new DistributionError('invalid-format', 'Invalid locale identifier', path, { cause })
  }
}

/** Normalize translation keys and require the declared default; preserve literal text and contents. */
export function normalizeLocalizedText(
  input: unknown,
  defaultLocale: string,
  path: FieldPath = [],
): LocalizedText {
  const fallback = normalizeLocale(defaultLocale)
  if (typeof input === 'string') {
    return string(input, path, false)
  }

  const source = record(input, path)
  const entries = new Map<string, string>()
  for (const [key, value] of Object.entries(source)) {
    const locale = normalizeLocale(key, [...path, key])
    if (entries.has(locale)) {
      invalid([...path, key], 'Duplicate normalized locale')
    }
    entries.set(locale, string(value, [...path, key], false))
  }

  if (!entries.has(fallback)) {
    invalid(path, 'Localized text must contain its default locale')
  }
  return Object.fromEntries(entries)
}

/**
 * Select literal text, an exact tag, a compatible language/script variant, or the declared default.
 * Validates and normalizes external values; never interpolates messages or converts writing systems.
 */
export function resolveLocalizedText(
  input: LocalizedText,
  locale: string,
  defaultLocale: string,
): string {
  const text = normalizeLocalizedText(input, defaultLocale)
  if (typeof text === 'string') {
    return text
  }

  const requested = normalizeLocale(locale)
  const fallback = normalizeLocale(defaultLocale)
  if (Object.hasOwn(text, requested)) {
    return text[requested]!
  }

  const desired = new Intl.Locale(requested).maximize()
  const candidates = Object.keys(text)
    .filter((key) => {
      const candidate = new Intl.Locale(key).maximize()
      return candidate.language === desired.language && candidate.script === desired.script
    })
    .sort()
  return text[match([requested], candidates, fallback)]!
}

/** Validate a URL reference without resolving or rewriting its signed spelling. */
export function parseUrlReference(input: unknown, path: FieldPath = []): string {
  const value = string(input, path)
  if (!URL.canParse(value, 'https://registry.invalid/index.json')) {
    invalid(path, 'Invalid URL reference')
  }
  return value
}

/** Validate an absolute web/contact URL without loading it or changing its original spelling. */
export function parseAbsoluteUrl(input: unknown, path: FieldPath = []): string {
  const value = parseUrlReference(input, path)
  // Scheme policy belongs to the actual network/open operation.
  if (!URL.canParse(value)) {
    invalid(path, 'Expected an absolute URL')
  }
  return value
}

/** Parse common static fields, preserving unknown categories and normalizing only locale identifiers. */
export function parseMetadata(value: Record<string, unknown>, path: FieldPath): ExtensionMetadata {
  const defaultLocale = normalizeLocale(value.defaultLocale, [...path, 'defaultLocale'])
  const localized = (input: unknown, location: FieldPath) =>
    normalizeLocalizedText(input, defaultLocale, location)
  const strings = (input: unknown, location: FieldPath) => array(input, location, string)

  return {
    defaultLocale,
    name: localized(value.name, [...path, 'name']),
    ...optional(value, 'description', path, localized),

    ...optional(value, 'categories', path, strings),
    ...optional(value, 'keywords', path, strings),

    ...optional(value, 'author', path, (input, location): ExtensionAuthor => {
      const author = record(input, location)
      return {
        name: string(author.name, [...location, 'name']),
        ...optional(author, 'url', location, parseAbsoluteUrl),
      }
    }),
    ...optional(value, 'homepage', path, parseAbsoluteUrl),
    ...optional(value, 'repository', path, parseAbsoluteUrl),
    ...optional(value, 'issues', path, parseAbsoluteUrl),
  }
}
