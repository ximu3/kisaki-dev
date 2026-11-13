/** @fileoverview Formats a validated immutable catalog snapshot without owning language selection or registration. */

import { IntlMessageFormat } from 'intl-messageformat'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseUiLocale,
  parseExtensionUiTranslationDefinition,
} from '@kisaki3/desktop-contracts/i18n'
import type {
  MessageCatalog,
  ExtensionUiTranslationDefinition,
} from '@kisaki3/desktop-contracts/i18n'
import { englishMessages } from './en/index'
import type { Translate, TranslationCall } from './contracts.generated'
import {
  checkMessageCompatibility,
  flattenMessages,
  flattenParsedCatalog,
  indexMessageSource,
  validateMessageArguments,
} from './messages'

/**
 * Indexed English fallback text and its derived argument contracts, created from the same message
 * source.
 */
const { messages: source, contracts } = indexMessageSource(englishMessages)

/**
 * Parses an extension translation definition and checks known messages against the English
 * baseline.
 *
 * Returns the normalized definition after complete validation. Unknown message leaves are retained
 * for compatibility with other baseline versions.
 */
export function validateExtensionUiTranslationDefinition(
  input: unknown,
): ExtensionUiTranslationDefinition {
  const value = parseExtensionUiTranslationDefinition(input)
  checkMessageCompatibility(flattenParsedCatalog(value.messages), contracts)
  return value
}

/**
 * Creates a typed formatter bound to one locale and catalog snapshot.
 *
 * Missing messages use English text and formatting rules; present empty strings remain
 * translations. Calls retain the English argument contract, and markup is literal text. The caller
 * creates a new formatter when the locale or catalog changes.
 */
export function createTranslator(locale: string, catalog: MessageCatalog = {}): Translate {
  const language = parseUiLocale(locale)
  const translated = flattenMessages(catalog)
  checkMessageCompatibility(translated, contracts)

  const formatters = new Map<string, IntlMessageFormat>()

  return (...args: TranslationCall): string => {
    const [key, input] = args
    if (!Object.hasOwn(contracts, key)) {
      throw new DesktopError('InvalidInput', 'Unknown message key')
    }

    const values = validateMessageArguments(contracts[key]!, input)
    let formatter = formatters.get(key)
    if (!formatter) {
      const present = Object.hasOwn(translated, key)
      formatter = new IntlMessageFormat(
        present ? translated[key]! : source[key]!,
        present ? language : 'en',
        undefined,
        { ignoreTag: true },
      )
      formatters.set(key, formatter)
    }

    try {
      const text = formatter.format(values)
      if (typeof text !== 'string') {
        throw new TypeError('Message must format to plain text')
      }
      return text
    } catch (cause) {
      throw new DesktopError('InvalidInput', 'Message formatting failed', { cause })
    }
  }
}
