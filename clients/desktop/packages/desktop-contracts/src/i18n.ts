/** @fileoverview Publishes the English author baseline, generated calls and owner-bound translation registration values. */

import * as v from 'valibot'
import { parseId, normalizeLocale } from '@kisaki3/extension-distribution/metadata'
import type { CallOptions, Disposable, Listener, Registration } from './operations'
import { id, nonemptyText, parseExternalValue, parseValue } from './validation'
import { englishMessages } from './i18n/en/index'
import { validateMessageCatalog } from './i18n/messages'
import type { MessageCatalog } from './i18n/messages'

export { englishMessages } from './i18n/en/index'
export {
  flattenMessages,
  getMessageContracts,
  getMessageParameterContract,
  validateMessageArguments,
  validateMessageCatalog,
} from './i18n/messages'
export type {
  MessageCatalog,
  MessageArgumentKind,
  MessageContracts,
  MessageParameterContract,
} from './i18n/messages'
export type {
  MessageArguments,
  MessageKey,
  TranslationCall,
  Translate,
} from './i18n/contracts.generated'

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
  list(call?: CallOptions): Promise<readonly UiTranslation[]>

  register(
    input: UiTranslationRegistration,
    call?: CallOptions,
  ): Promise<Registration<UiTranslationRef & { readonly type: 'extension' }>>

  onInvalidated(listener: () => void): Disposable
}

/** Actual effective language; a lost translation falls back without changing the saved selection. */
export interface UiLocaleApi {
  get(): UiLocale
  onChanged(listener: Listener<UiLocale>): Disposable
}

export interface I18nApi {
  readonly translations: UiTranslationsApi
  readonly locale: UiLocaleApi
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

/** Reject a whole invalid translation. Third parties may omit keys; official builds explicitly request complete coverage. */
export function validateUiTranslation(
  input: unknown,
  options: { readonly complete?: boolean } = {},
): UiTranslationRegistration {
  return parseValue(
    v.strictObject({
      id,
      locale: v.pipe(v.unknown(), v.transform(parseUiLocale)),
      name: nonemptyText,
      messages: v.pipe(
        v.unknown(),
        v.transform((messages) => validateMessageCatalog(messages, englishMessages, options)),
      ),
    }),
    input,
    'Invalid UI translation',
  )
}
