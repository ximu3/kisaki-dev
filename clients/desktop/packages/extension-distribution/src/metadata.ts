import { match } from '@formatjs/intl-localematcher'
import { DistributionError, type FieldPath } from './errors'
import {
  parseArray,
  rejectFormat,
  parseOptionalField,
  parseRecord,
  parseString,
} from './validation'

export type LocalizedText = string | Readonly<Record<string, string>>

export const extensionCategories = Object.freeze([
  'metadata',
  'integration',
  'theme',
  'tool',
  'language',
] as const)

export type ExtensionCategory = (typeof extensionCategories)[number]

export function parseCategory(input: unknown, path: FieldPath = []): ExtensionCategory {
  const value = parseString(input, path)
  const category = extensionCategories.find((known) => known === value)
  if (category === undefined) {
    rejectFormat(path, 'Unknown category for a new declaration')
  }

  return category
}

export interface ExtensionAuthor {
  readonly name: string
  readonly url?: string
}

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

export function parseId(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  if (!/^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]*[a-z0-9])?)*$/.test(value)) {
    rejectFormat(path, 'Invalid extension or registry ID')
  }

  return value
}

export function normalizeLocale(input: unknown, path: FieldPath = []): string {
  const locale = parseString(input, path)
  try {
    return Intl.getCanonicalLocales(locale)[0]!
  } catch (cause) {
    throw new DistributionError('invalid-format', 'Invalid locale identifier', path, { cause })
  }
}

export function normalizeLocalizedText(
  input: unknown,
  defaultLocale: string,
  path: FieldPath = [],
): LocalizedText {
  const fallback = normalizeLocale(defaultLocale)
  if (typeof input === 'string') {
    return parseString(input, path, false)
  }

  const source = parseRecord(input, path)
  const entries = new Map<string, string>()
  for (const [key, value] of Object.entries(source)) {
    const locale = normalizeLocale(key, [...path, key])
    if (entries.has(locale)) {
      rejectFormat([...path, key], 'Duplicate normalized locale')
    }
    entries.set(locale, parseString(value, [...path, key], false))
  }

  if (!entries.has(fallback)) {
    rejectFormat(path, 'Localized text must contain its default locale')
  }

  return Object.fromEntries(entries)
}

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

export function parseUrlReference(input: unknown, path: FieldPath = []): string {
  const value = parseString(input, path)
  if (!URL.canParse(value, 'https://registry.invalid/index.json')) {
    rejectFormat(path, 'Invalid URL reference')
  }

  return value
}

export function parseAbsoluteUrl(input: unknown, path: FieldPath = []): string {
  const value = parseUrlReference(input, path)
  if (!URL.canParse(value)) {
    rejectFormat(path, 'Expected an absolute URL')
  }

  return value
}

export function parseMetadata(value: Record<string, unknown>, path: FieldPath): ExtensionMetadata {
  const defaultLocale = normalizeLocale(value.defaultLocale, [...path, 'defaultLocale'])
  const localized = (input: unknown, location: FieldPath) =>
    normalizeLocalizedText(input, defaultLocale, location)
  const strings = (input: unknown, location: FieldPath) => parseArray(input, location, parseString)

  return {
    defaultLocale,
    name: localized(value.name, [...path, 'name']),
    ...parseOptionalField(value, 'description', path, localized),

    ...parseOptionalField(value, 'categories', path, strings),
    ...parseOptionalField(value, 'keywords', path, strings),

    ...parseOptionalField(value, 'author', path, (input, location): ExtensionAuthor => {
      const author = parseRecord(input, location)
      return {
        name: parseString(author.name, [...location, 'name']),
        ...parseOptionalField(author, 'url', location, parseAbsoluteUrl),
      }
    }),
    ...parseOptionalField(value, 'homepage', path, parseAbsoluteUrl),
    ...parseOptionalField(value, 'repository', path, parseAbsoluteUrl),
    ...parseOptionalField(value, 'issues', path, parseAbsoluteUrl),
  }
}
