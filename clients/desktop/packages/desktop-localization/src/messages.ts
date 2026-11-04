/** @fileoverview Derives ICU argument contracts and validates translations against an explicit source catalog. */

import type { MessageCatalog } from '@kisaki3/desktop-contracts/i18n'
import { parseMessageCatalog } from '@kisaki3/desktop-contracts/i18n'
import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

export type MessageArgumentKind = 'string' | 'number' | 'date'

/** Allowed domains are intersected over every use, including nested select/plural branches. */
export type MessageParameterContract = Readonly<Record<string, readonly MessageArgumentKind[]>>

export type MessageContracts = Readonly<Record<string, MessageParameterContract>>

/** Flatten a pure catalog for validation/indexing; empty strings remain present and unknown keys are not discarded. */
export function flattenMessages(input: unknown): Readonly<Record<string, string>> {
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

  visit(parseMessageCatalog(input), '')
  return Object.fromEntries(result)
}

/** Parse ICU with literal tags. Incompatible uses of one parameter reject the message instead of guessing its type. */
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
      if (element.type === TYPE.literal || element.type === TYPE.pound) {
        continue
      }
      if (element.type === TYPE.tag) {
        throw new DesktopError('InvalidInput', 'Rich message tags are not supported')
      }

      let kinds: readonly MessageArgumentKind[]
      switch (element.type) {
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

/** Derive the one author/type-generation baseline from source text; no independently maintained parameter table is accepted. */
export function getMessageContracts(source: MessageCatalog): MessageContracts {
  return Object.fromEntries(
    Object.entries(flattenMessages(source)).map(([key, message]) => [
      key,
      getMessageParameterContract(message),
    ]),
  )
}

/** Unknown leaves are ignored by current resolution. Known leaves may omit parameters but may not narrow valid source calls. */
export function validateMessageCatalog(
  input: unknown,
  source: MessageCatalog,
  options: { readonly complete?: boolean } = {},
): MessageCatalog {
  const catalog = parseMessageCatalog(input)
  const translated = flattenMessages(catalog)
  const contracts = getMessageContracts(source)
  for (const [key, contract] of Object.entries(contracts)) {
    if (!Object.hasOwn(translated, key)) {
      if (options.complete) {
        throw new DesktopError('InvalidInput', 'Translation is missing a required message')
      }
      continue
    }

    const translatedContract = getMessageParameterContract(translated[key]!)
    for (const [parameter, kinds] of Object.entries(translatedContract)) {
      const required = contract[parameter]
      if (
        !Object.hasOwn(contract, parameter) ||
        !required ||
        required.some((kind) => !kinds.includes(kind))
      ) {
        throw new DesktopError('InvalidInput', 'Translated message narrows or adds a parameter')
      }
    }
  }

  return catalog
}

/** Check the complete source call, even when a selected translation omits some arguments. Missing arguments are program errors. */
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
