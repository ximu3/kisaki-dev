import { parseMessageCatalog, type MessageCatalog } from '@kisaki3/desktop-contracts/i18n'
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { IntlMessageFormat } from 'intl-messageformat'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

export type MessageArgumentKind = 'string' | 'number' | 'timestamp' | 'date'

export type MessageParameterContract = Readonly<Record<string, readonly MessageArgumentKind[]>>

export type MessageContracts = Readonly<Record<string, MessageParameterContract>>

function admits(kinds: readonly MessageArgumentKind[], kind: MessageArgumentKind): boolean {
  return kinds.includes(kind) || (kind === 'timestamp' && kinds.includes('number'))
}

export function flattenParsedCatalog(catalog: MessageCatalog): Readonly<Record<string, string>> {
  const result = new Map<string, string>()

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

export function flattenMessages(input: unknown): Readonly<Record<string, string>> {
  return flattenParsedCatalog(parseMessageCatalog(input))
}

export function getMessageParameterContract(message: string): MessageParameterContract {
  let ast: MessageFormatElement[]
  try {
    ast = parse(message, { ignoreTag: true })
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid ICU message', { cause })
  }

  const parameters = new Map<string, readonly MessageArgumentKind[]>()

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
          kinds = ['timestamp', 'date']
          break
        case TYPE.number:
        case TYPE.plural:
          kinds = ['number']
          break
      }

      const previous = parameters.get(element.value)
      const intersection = previous
        ? [
            ...previous.filter((kind) => admits(kinds, kind)),
            ...kinds.filter((kind) => !previous.includes(kind) && admits(previous, kind)),
          ]
        : kinds
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

export function indexMessageSource(source: MessageCatalog) {
  const messages = flattenMessages(source)
  const contracts: MessageContracts = Object.fromEntries(
    Object.entries(messages).map(([key, message]) => [key, getMessageParameterContract(message)]),
  )
  return { messages, contracts }
}

export function getMessageContracts(source: MessageCatalog): MessageContracts {
  return indexMessageSource(source).contracts
}

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
        contract[parameter]!.some((kind) => !admits(kinds, kind))
      ) {
        throw new DesktopError('InvalidInput', 'Translated message narrows or adds a parameter')
      }
    }
  }
}

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
      kind = Math.abs(value) <= 8.64e15 ? 'timestamp' : 'number'
    } else if (value instanceof Date && Number.isFinite(value.getTime())) {
      kind = 'date'
    }
    if (!Object.hasOwn(values, key) || kind === null || !admits(kinds, kind)) {
      throw new DesktopError('InvalidInput', 'Missing or invalid message parameter')
    }
  }

  return values as Readonly<Record<string, string | number | Date>>
}
