/** @fileoverview Defines generic message catalogs, translation registration and effective-language observation. */

import type { CallOptions, Registration, Disposable, Listener } from './operations'
import { readRecord, parseExternalValue, parseValue, id, nonemptyText } from './validation'
import { DesktopError } from './errors'
import { normalizeLocale, parseId } from '@kisaki3/extension-distribution/metadata'
import * as v from 'valibot'

/** Groups contain ordinary data objects, leaves are ICU source strings, and individual keys never contain dots. */
export interface MessageCatalog {
  readonly [key: string]: string | MessageCatalog
}

/** Canonical Intl-supported baseName; language availability and selection are separate concerns. */
export type UiLocale = string

export type UiTranslationRef =
  | { readonly type: 'builtin'; readonly id: 'en' }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }

/** An extension-local ID is bound to the actual registering owner by the host, never supplied as an extension identity here. */
export interface UiTranslationRegistration {
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
  /** Read available translation identities and native display names, including built-in English. */
  list(call?: CallOptions): Promise<readonly UiTranslation[]>

  /**
   * Validate known messages against the application's English contract before registering the
   * supplied catalog for this extension instance; failure preserves existing translations.
   */
  register(
    input: UiTranslationRegistration,
    call?: CallOptions,
  ): Promise<Registration<UiTranslationRef & { readonly type: 'extension' }>>

  /**
   * Subscribe to translation-directory invalidation; removal preserves saved selection and lets
   * effective language fall back.
   */
  onInvalidated(listener: () => void): Disposable
}

/** Actual effective language; a lost translation falls back without changing the saved selection. */
export interface UiLocaleApi {
  /**
   * Read the currently effective locale, including fallback, rather than the saved translation
   * selection.
   */
  get(): UiLocale

  /**
   * Subscribe to changes of effective locale; releasing the listener does not change language or
   * saved preferences.
   */
  onChanged(listener: Listener<UiLocale>): Disposable
}

export interface I18nApi {
  readonly translations: UiTranslationsApi
  readonly locale: UiLocaleApi
}

/** Parse the complete catalog shape without interpreting ICU, selecting a language or applying a product baseline. */
export function parseMessageCatalog(input: unknown): MessageCatalog {
  const ancestors = new Set<object>()

  function group(value: unknown): MessageCatalog {
    const record = readRecord(value)
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
      return [key, typeof child === 'string' ? child : group(child)]
    })

    ancestors.delete(record)
    return Object.fromEntries(entries)
  }

  return group(input)
}

/** Parse the shared canonical locale syntax and strip Unicode extension options through the same distribution rule. */
export function parseUiLocale(input: unknown): UiLocale {
  return new Intl.Locale(parseExternalValue(normalizeLocale, input, 'Invalid UI locale')).baseName
}

/** Retain the complete stable reference even when its owning extension is unavailable. */
export function parseUiTranslationRef(input: unknown): UiTranslationRef {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('builtin'), id: v.literal('en') }),
      v.strictObject({
        type: v.literal('extension'),
        extensionId: v.pipe(
          v.unknown(),
          v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
        ),
        id,
      }),
    ]),
    input,
    'Invalid UI translation reference',
  )
}

/** Parse registration values; the host additionally checks message compatibility against its localization baseline. */
export function parseUiTranslationRegistration(input: unknown): UiTranslationRegistration {
  return parseValue(
    v.strictObject({
      id,
      locale: v.pipe(v.unknown(), v.transform(parseUiLocale)),
      name: nonemptyText,
      messages: v.pipe(v.unknown(), v.transform(parseMessageCatalog)),
    }),
    input,
    'Invalid UI translation',
  )
}
