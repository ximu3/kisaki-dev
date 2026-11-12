/** @fileoverview Derives ICU argument contracts and validates translations against an explicit source catalog. */

import type { MessageCatalog } from '@kisaki3/desktop-contracts/i18n'
import { parseMessageCatalog } from '@kisaki3/desktop-contracts/i18n'
import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'
import { IntlMessageFormat } from 'intl-messageformat'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Runtime ICU argument category: string, finite number, or valid Date object. */
export type MessageArgumentKind = 'string' | 'number' | 'date'

/**
 * Allowed runtime kinds for every parameter used by one message.
 *
 * Each kind set is the intersection of all uses, including nested select and plural branches.
 */
export type MessageParameterContract = Readonly<Record<string, readonly MessageArgumentKind[]>>

/** Message-key index of parameter contracts derived from an explicit source catalog. */
export type MessageContracts = Readonly<Record<string, MessageParameterContract>>

/** Indexes a parsed catalog's leaf strings by dot-separated paths. */
export function flattenParsedCatalog(catalog: MessageCatalog): Readonly<Record<string, string>> {
  const result = new Map<string, string>()

  /** Traverses one message group and records each leaf under its full key path. */
  function visit(group: MessageCatalog, prefix: string): void {
    for (const [key, child] of Object.entries(group)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (typeof child === 'string') {
        result.set(path, child)
      } else {
        visit(child, path)
      }
    }
  }

  visit(catalog, '')
  return Object.fromEntries(result)
}

/**
 * Parses a catalog and indexes all leaf strings by dot-separated path.
 *
 * Retains unknown keys and empty strings for compatibility checks and fallback decisions.
 */
export function flattenMessages(input: unknown): Readonly<Record<string, string>> {
  return flattenParsedCatalog(parseMessageCatalog(input))
}

/**
 * Derives the accepted runtime kinds for each parameter in an ICU message.
 *
 * Intersects uses across nested branches and checks number-format options through Intl. Invalid
 * ICU, incompatible uses or invalid number options throw InvalidInput. Markup is parsed as literal
 * text.
 */
export function getMessageParameterContract(message: string): MessageParameterContract {
  let ast: MessageFormatElement[]
  try {
    ast = parse(message, { ignoreTag: true })
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid ICU message', { cause })
  }

  const parameters = new Map<string, readonly MessageArgumentKind[]>()

  /** Visits ICU elements, validates number options and intersects repeated parameter uses. */
  function visit(elements: readonly MessageFormatElement[]): void {
    for (const element of elements) {
      if (element.type === TYPE.number && element.style) {
        // FormatJS leaves named and skeleton number options for Intl to check at formatting time.
        const options =
          typeof element.style === 'string'
            ? IntlMessageFormat.formats.number[element.style]
            : element.style.parsedOptions
        try {
          new Intl.NumberFormat(undefined, options)
        } catch (cause) {
          throw new DesktopError('InvalidInput', 'Invalid ICU number format', { cause })
        }
      }

      let kinds: readonly MessageArgumentKind[]
      switch (element.type) {
        case TYPE.literal:
        case TYPE.pound:
        case TYPE.tag: // ignoreTag parses markup as literal text.
          continue
        case TYPE.argument:
          kinds = ['string', 'number']
          break
        case TYPE.select:
          kinds = ['string']
          break
        case TYPE.date:
        case TYPE.time:
          kinds = ['number', 'date']
          break
        case TYPE.number:
        case TYPE.plural:
          kinds = ['number']
          break
      }

      const previous = parameters.get(element.value)
      const intersection = previous ? previous.filter((kind) => kinds.includes(kind)) : kinds
      if (intersection.length === 0) {
        throw new DesktopError('InvalidInput', 'ICU parameter formats are incompatible')
      }
      parameters.set(element.value, intersection)

      if (element.type === TYPE.select || element.type === TYPE.plural) {
        for (const option of Object.values(element.options)) {
          visit(option.value)
        }
      }
    }
  }

  visit(ast)
  return Object.fromEntries(
    [...parameters].sort(([left], [right]) => {
      if (left === right) {
        return 0
      }

      return left < right ? -1 : 1
    }),
  )
}

/** Builds matching indexes of source text and ICU parameter contracts. */
export function indexMessageSource(source: MessageCatalog) {
  const messages = flattenMessages(source)
  const contracts: MessageContracts = Object.fromEntries(
    Object.entries(messages).map(([key, message]) => [key, getMessageParameterContract(message)]),
  )
  return { messages, contracts }
}

/** Derives source-message parameter contracts for author validation and generated call types. */
export function getMessageContracts(source: MessageCatalog): MessageContracts {
  return indexMessageSource(source).contracts
}

/**
 * Checks known translated messages against source argument contracts.
 *
 * Translations may omit parameters but cannot introduce names or exclude kinds accepted by the
 * source. complete requires all source keys; unknown translation keys are outside this check.
 */
export function checkMessageCompatibility(
  translated: Readonly<Record<string, string>>,
  contracts: MessageContracts,
  complete = false,
): void {
  for (const [key, contract] of Object.entries(contracts)) {
    if (!Object.hasOwn(translated, key)) {
      if (complete) {
        throw new DesktopError('InvalidInput', 'Translation is missing a required message')
      }
      continue
    }

    const translatedContract = getMessageParameterContract(translated[key]!)
    for (const [parameter, kinds] of Object.entries(translatedContract)) {
      if (
        !Object.hasOwn(contract, parameter) ||
        contract[parameter]!.some((kind) => !kinds.includes(kind))
      ) {
        throw new DesktopError('InvalidInput', 'Translated message narrows or adds a parameter')
      }
    }
  }
}

/**
 * Parses a translation catalog and checks known messages against the supplied source.
 *
 * Missing keys are allowed by default; complete=true requires every source leaf. Empty leaves count
 * as present, and unknown leaves remain in the returned catalog.
 */
export function validateMessageCatalog(
  input: unknown,
  source: MessageCatalog,
  options: { readonly complete?: boolean } = {},
): MessageCatalog {
  const catalog = parseMessageCatalog(input)
  checkMessageCompatibility(
    flattenParsedCatalog(catalog),
    getMessageContracts(source),
    options.complete,
  )
  return catalog
}

/**
 * Validates one call against the complete source message contract.
 *
 * Requires all source parameters even when a translation omits them. Rejects unknown names and
 * invalid runtime kinds. Returns the accepted argument object; undefined supplies an empty object
 * for an argument-free call.
 */
export function validateMessageArguments(
  contract: MessageParameterContract,
  input: unknown,
): Readonly<Record<string, string | number | Date>> {
  const value: unknown = input === undefined ? {} : input
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DesktopError('InvalidInput', 'Message arguments must be an ordinary data object')
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== null && prototype !== Object.prototype) {
    throw new DesktopError('InvalidInput', 'Message arguments must be an ordinary data object')
  }
  const values = value as Record<string, unknown>
  if (Object.keys(values).some((key) => !Object.hasOwn(contract, key))) {
    throw new DesktopError('InvalidInput', 'Unknown message parameter')
  }

  for (const [key, kinds] of Object.entries(contract)) {
    const value = values[key]
    let kind: MessageArgumentKind | null = null
    if (typeof value === 'string') {
      kind = 'string'
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      kind = 'number'
    } else if (value instanceof Date && Number.isFinite(value.getTime())) {
      kind = 'date'
    }
    if (!Object.hasOwn(values, key) || kind === null || !kinds.includes(kind)) {
      throw new DesktopError('InvalidInput', 'Missing or invalid message parameter')
    }
  }

  return values as Readonly<Record<string, string | number | Date>>
}
