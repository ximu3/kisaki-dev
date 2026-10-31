/**
 * @fileoverview Defines static localized text values used by extension manifests and
 * contribution metadata.
 */

import { match } from '@formatjs/intl-localematcher'
import * as v from 'valibot'
import { recordSchema } from './schema'
import { DistributionError, parseFormat } from './validation'

/** Static display text. Locale maps must include their owner's defaultLocale. */
export type LocalizedText = string | Readonly<Record<string, string>>

/** A normalized BCP 47 base name, independent of a user's formatting extensions. */
export type LanguageTag = string

export const localizedTextSchema = v.union([v.string(), recordSchema(v.string(), v.string())])

/** Canonicalize a supported language tag to its base name; do not infer a selected translation. */
export function parseLanguageTag(input: unknown): LanguageTag {
  const value = parseFormat(v.string(), input, 'language tag')
  try {
    return new Intl.Locale(value).baseName
  } catch (cause) {
    throw new DistributionError('InvalidFormat', 'Invalid language tag.', { cause })
  }
}

/** Normalize locale keys and reject collisions or a missing owner's default value. */
export function parseLocalizedText(input: unknown, defaultLocale: LanguageTag): LocalizedText {
  const value = parseFormat(localizedTextSchema, input, 'localized text')
  const fallback = parseLanguageTag(defaultLocale)
  if (typeof value === 'string') {
    return value
  }
  const entries: [string, string][] = []
  const seen = new Set<string>()
  for (const [key, text] of Object.entries(value)) {
    const locale = parseLanguageTag(key)
    if (seen.has(locale)) {
      throw new DistributionError('InvalidFormat', 'Localized text has colliding locale keys.')
    }
    seen.add(locale)
    entries.push([locale, text])
  }
  if (!seen.has(fallback)) {
    throw new DistributionError('InvalidFormat', 'Localized text is missing its default locale.')
  }
  return Object.fromEntries(entries)
}

/** Select exact, then language-and-script compatible text, finally the owner's explicit default. */
export function resolveLocalizedText(
  input: LocalizedText,
  locale: LanguageTag,
  defaultLocale: LanguageTag,
): string {
  const value = parseLocalizedText(input, defaultLocale)
  if (typeof value === 'string') {
    return value
  }
  const requested = parseLanguageTag(locale)
  const fallback = parseLanguageTag(defaultLocale)
  const exact = value[requested]
  if (exact !== undefined) {
    return exact
  }
  const target = new Intl.Locale(requested).maximize()
  const candidates = Object.keys(value)
    .filter((key) => {
      const candidate = new Intl.Locale(key).maximize()
      return candidate.language === target.language && candidate.script === target.script
    })
    .sort()
  const selected = match([requested], candidates, fallback)
  // parseLocalizedText has established the required fallback, even when its text is empty.
  return value[selected] ?? value[fallback]!
}
