/** @fileoverview Exposes translation identities, locale observation, and the English author validation contract. */

import * as v from 'valibot'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { CallOptions, Disposable, Registration } from '../execution'
import { objectSchema } from '../schema'
import { nonemptyStringSchema, parseContract } from '../validation'
import type { MessageCatalog } from './catalog'

/** A normalized BCP 47 base name, independent of which translation with that locale is selected. */
export type UiLocale = string
export type UiTranslationRef =
  | { readonly type: 'builtin'; readonly id: 'en' }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }
/** One available contribution; selection retains its full identity even while the owner is unavailable. */
export interface UiTranslationDefinition {
  readonly ref: Extract<UiTranslationRef, { type: 'extension' }>
  readonly locale: UiLocale
  readonly name: LocalizedText
  readonly messages: MessageCatalog
}
export interface UiTranslationSummary {
  readonly ref: UiTranslationRef
  readonly locale: UiLocale
  readonly name: LocalizedText
}
/** Native registration and effective locale are separate from saved preference selection. */
export interface I18nApi {
  readonly translations: {
    /** Read currently available choices, including the built-in English catalog. */
    list(call?: CallOptions): Promise<readonly UiTranslationSummary[]>
    /** Validate the complete contribution against English before publishing it; duplicate refs fail. */
    register(definition: UiTranslationDefinition): Promise<Registration<UiTranslationRef>>
    /** Notify that the current translation directory should be reread. */
    onInvalidated(listener: () => void): Disposable
  }
  readonly locale: {
    /** Read the actual effective locale, including English fallback when a selected owner is unavailable. */
    get(call?: CallOptions): Promise<UiLocale>
    /** Deliver actual locale changes for this observer's lifetime. */
    onChanged(listener: (locale: UiLocale) => void): Disposable
  }
}
export const uiTranslationRefSchema: v.GenericSchema<unknown, UiTranslationRef> = v.union([
  objectSchema({ type: v.literal('builtin'), id: v.literal('en') }),
  objectSchema({
    type: v.literal('extension'),
    extensionId: nonemptyStringSchema,
    id: nonemptyStringSchema,
  }),
])
/** Parse a full stable translation identity without selecting or activating its owner. */
export function parseUiTranslationRef(input: unknown): UiTranslationRef {
  return parseContract(uiTranslationRefSchema, input, 'UI translation reference')
}

export { compileMessageContract, validateTranslation, renderMessageDeclarations } from './catalog'
export type { MessageCatalog, MessageArgumentKind, MessageContract } from './catalog'
export { englishMessages } from './english'
export type { MessageParameters, MessageKey, MessageCall, Translate } from './messages.generated'
