import type { CallOptions, Registration, Disposable, Listener } from './operations'
import {
  fromParser,
  parseRecord,
  parseExternalValue,
  parseValue,
  id,
  nonemptyText,
} from './validation'
import { DesktopError } from './errors'
import { normalizeLocale, parseId } from '@kisaki3/extension-distribution/metadata'
import * as v from 'valibot'

export interface MessageCatalog {
  readonly [key: string]: string | MessageCatalog
}

export type UiLocale = string

export type UiTranslationRef =
  | { readonly type: 'builtin'; readonly id: 'en' | 'zh-Hans' }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }

export interface ExtensionUiTranslationDefinition {
  readonly id: string
  readonly locale: UiLocale
  readonly name: string
  readonly messages: MessageCatalog
}

export interface UiTranslation {
  readonly ref: UiTranslationRef
  readonly locale: UiLocale
  readonly name: string
}

export interface UiTranslationsApi {
  list(call?: CallOptions): Promise<readonly UiTranslation[]>

  register(
    input: ExtensionUiTranslationDefinition,
    call?: CallOptions,
  ): Promise<Registration<UiTranslationRef & { readonly type: 'extension' }>>

  onInvalidated(listener: () => void): Disposable
}

export interface UiLocaleApi {
  get(): UiLocale

  onChanged(listener: Listener<UiLocale>): Disposable
}

export interface I18nApi {
  readonly translations: UiTranslationsApi
  readonly locale: UiLocaleApi
}

export function parseMessageCatalog(input: unknown): MessageCatalog {
  const ancestors = new Set<object>()

  function parseMessageGroup(value: unknown): MessageCatalog {
    const record = parseRecord(value)
    if (ancestors.has(record)) {
      throw new DesktopError('InvalidInput', 'Message catalogs cannot contain cycles')
    }
    ancestors.add(record)

    const entries = Object.keys(record).map((key): [string, string | MessageCatalog] => {
      if (key.length === 0 || key.includes('.')) {
        throw new DesktopError('InvalidInput', 'Message keys must be nonempty path segments')
      }
      const property = Object.getOwnPropertyDescriptor(record, key)!
      if (!Object.hasOwn(property, 'value')) {
        throw new DesktopError('InvalidInput', 'Message catalogs require data properties')
      }
      const child: unknown = property.value
      return [key, typeof child === 'string' ? child : parseMessageGroup(child)]
    })

    ancestors.delete(record)
    return Object.fromEntries(entries)
  }

  return parseMessageGroup(input)
}

export function parseUiLocale(input: unknown): UiLocale {
  return new Intl.Locale(parseExternalValue(normalizeLocale, input, 'Invalid UI locale')).baseName
}

export function parseUiTranslationRef(input: unknown): UiTranslationRef {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('builtin'), id: v.picklist(['en', 'zh-Hans']) }),
      v.strictObject({
        type: v.literal('extension'),
        extensionId: fromParser((value) =>
          parseExternalValue(parseId, value, 'Invalid extension identity'),
        ),
        id,
      }),
    ]),
    input,
    'Invalid UI translation reference',
  )
}

export function parseExtensionUiTranslationDefinition(
  input: unknown,
): ExtensionUiTranslationDefinition {
  return parseValue(
    v.strictObject({
      id,
      locale: fromParser(parseUiLocale),
      name: nonemptyText,
      messages: fromParser(parseMessageCatalog),
    }),
    input,
    'Invalid UI translation',
  )
}
