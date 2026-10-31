/** @fileoverview Compiles ICU message argument contracts and validates translations against their English source. */

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { invalidInput } from '../errors'

/** Groups contain only nested groups and ICU string leaves; each key is a single path component. */
export interface MessageCatalog {
  readonly [key: string]: string | MessageCatalog
}
/** Exact argument kinds produced from ICU usage, independent of any formatter's AST implementation. */
export type MessageArgumentKind = 'text' | 'string' | 'number' | 'date'
export type MessageContract = Readonly<
  Record<string, Readonly<Record<string, MessageArgumentKind>>>
>

/** Compile all English leaves and merge actual argument constraints; incompatible uses reject the catalog. */
export function compileMessageContract(catalog: MessageCatalog): MessageContract {
  return Object.fromEntries(
    [...flattenCatalog(catalog)].map(([key, message]) => [key, argumentContract(message)]),
  )
}

/**
 * Validate known translation keys and their argument compatibility. Missing keys use English unless
 * complete is required; unknown keys remain unused, and an explicit empty string remains a translation.
 */
export function validateTranslation(
  base: MessageCatalog,
  translation: MessageCatalog,
  options: { readonly complete?: boolean } = {},
): void {
  const contract = compileMessageContract(base)
  const translated = flattenCatalog(translation)
  if (options.complete && Object.keys(contract).some((key) => !translated.has(key))) {
    invalidInput('The translation does not cover the complete English catalog.')
  }
  for (const [key, message] of translated) {
    const expected = contract[key]
    if (expected === undefined) {
      continue
    }
    const actual = argumentContract(message)
    for (const [name, kind] of Object.entries(actual)) {
      const baseline = expected[name]
      if (
        baseline === undefined ||
        (argumentMask(baseline) & argumentMask(kind)) !== argumentMask(baseline)
      ) {
        invalidInput('A translation argument is incompatible with the English contract.')
      }
    }
  }
}

/** Generate native TypeScript tuple-correlated calls, without parsing ICU strings through recursive types. */
export function renderMessageDeclarations(contract: MessageContract): string {
  const typeNames = {
    text: 'string | number',
    string: 'string',
    number: 'number',
    date: 'Date | number',
  } as const
  const lines = [
    '/** @fileoverview Generated message arguments from the English catalog; run pnpm generate:messages to update. */',
    '',
    'export interface MessageParameters {',
  ]
  for (const key of Object.keys(contract).sort()) {
    const parameters = contract[key]!
    const fields = Object.keys(parameters)
      .sort()
      .map((name) => `readonly ${JSON.stringify(name)}: ${typeNames[parameters[name]!]}`)
    lines.push(
      `  readonly ${JSON.stringify(key)}: ${fields.length ? `{ ${fields.join('; ')} }` : 'Record<never, never>'}`,
    )
  }
  lines.push(
    '}',
    '',
    'export type MessageKey = keyof MessageParameters',
    'export type MessageCall = { [Key in MessageKey]: keyof MessageParameters[Key] extends never ? [key: Key] : [key: Key, values: MessageParameters[Key]] }[MessageKey]',
    'export type Translate = (...input: MessageCall) => string',
    '',
  )
  return lines.join('\n')
}

/** Validate the recursive value shape and return stable leaf paths, preserving literal message text. */
export function flattenCatalog(input: MessageCatalog): ReadonlyMap<string, string> {
  const result = new Map<string, string>()
  const ancestors = new Set<object>()
  const pending: { value: unknown; path: string; exit?: object }[] = [{ value: input, path: '' }]
  while (pending.length) {
    const item = pending.pop()!
    if (item.exit) {
      ancestors.delete(item.exit)
      continue
    }
    if (typeof item.value === 'string' && item.path !== '') {
      result.set(item.path, item.value)
      continue
    }
    if (item.value === null || typeof item.value !== 'object' || Array.isArray(item.value)) {
      return invalidInput('Invalid message catalog value.')
    }
    const value = item.value
    const prototype: unknown = Object.getPrototypeOf(value)
    if ((prototype !== Object.prototype && prototype !== null) || ancestors.has(value)) {
      return invalidInput('Invalid message catalog structure.')
    }
    ancestors.add(value)
    pending.push({ value: null, path: item.path, exit: value })
    for (const key of Reflect.ownKeys(value).reverse()) {
      if (typeof key !== 'string' || key === '' || key.includes('.')) {
        return invalidInput('Invalid message catalog key.')
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        return invalidInput('Invalid message catalog property.')
      }
      pending.push({
        value: descriptor.value,
        path: item.path === '' ? key : `${item.path}.${key}`,
      })
    }
  }
  return result
}

function argumentContract(message: string): Readonly<Record<string, MessageArgumentKind>> {
  let syntax: MessageFormatElement[]
  try {
    syntax = parse(message, { ignoreTag: true })
  } catch {
    return invalidInput('Invalid ICU message syntax.')
  }
  const argumentsByName = new Map<string, number>()
  const pending = [...syntax]
  while (pending.length) {
    const element = pending.pop()!
    let mask: number
    switch (element.type) {
      case TYPE.literal:
      case TYPE.pound:
        continue
      case TYPE.argument:
        mask = 3
        break
      case TYPE.number:
        mask = 2
        break
      case TYPE.date:
      case TYPE.time:
        mask = 6
        break
      case TYPE.select:
      case TYPE.plural:
        mask = element.type === TYPE.select ? 1 : 2
        for (const option of Object.values(element.options)) {
          pending.push(...option.value)
        }
        break
      case TYPE.tag:
        return invalidInput('Rich-text message callbacks are not supported.')
    }
    const combined = (argumentsByName.get(element.value) ?? 7) & mask
    if (combined === 0) {
      return invalidInput('An English message argument has incompatible usages.')
    }
    argumentsByName.set(element.value, combined)
  }
  return Object.fromEntries([...argumentsByName].map(([name, mask]) => [name, argumentKind(mask)]))
}

function argumentMask(kind: MessageArgumentKind): number {
  switch (kind) {
    case 'text':
      return 3
    case 'string':
      return 1
    case 'number':
      return 2
    case 'date':
      return 6
  }
}
function argumentKind(mask: number): MessageArgumentKind {
  switch (mask) {
    case 1:
      return 'string'
    case 2:
      return 'number'
    case 3:
      return 'text'
    case 6:
      return 'date'
    default:
      return invalidInput('Invalid message argument constraint.')
  }
}
