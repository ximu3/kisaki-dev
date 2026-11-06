/** @fileoverview Formats a validated immutable catalog snapshot without owning language selection or registration. */

import { IntlMessageFormat } from 'intl-messageformat'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseUiLocale, parseUiTranslationRegistration } from '@kisaki3/desktop-contracts/i18n'
import type { MessageCatalog, UiTranslationRegistration } from '@kisaki3/desktop-contracts/i18n'
import { englishMessages } from './en/index'
import type { Translate, TranslationCall } from './contracts.generated'
import {
  checkMessageCompatibility,
  flattenMessages,
  flattenParsedCatalog,
  indexMessageSource,
  validateMessageArguments,
} from './messages'

const { messages: source, contracts } = indexMessageSource(englishMessages)

/** Validate registration shape and known message compatibility as one atomic unit. */
export function validateUiTranslation(input: unknown): UiTranslationRegistration {
  const value = parseUiTranslationRegistration(input)
  checkMessageCompatibility(flattenParsedCatalog(value.messages), contracts)
  return value
}

/** The caller replaces this snapshot when its effective language or catalog changes. Missing leaves use English plural rules. */
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
