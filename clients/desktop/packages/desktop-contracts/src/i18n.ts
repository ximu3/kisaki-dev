/** @fileoverview Defines generic message catalogs, translation registration and effective-language observation. */

import type { CallOptions, Registration, Disposable, Listener } from './operations'
import { parseRecord, parseExternalValue, parseValue, id, nonemptyText } from './validation'
import { DesktopError } from './errors'
import { normalizeLocale, parseId } from '@kisaki3/extension-distribution/metadata'
import * as v from 'valibot'

/**
 * Nested ordinary data groups whose leaves are ICU source strings.
 *
 * Individual keys are nonempty path segments without dots; empty message strings remain valid.
 */
export interface MessageCatalog {
  readonly [key: string]: string | MessageCatalog
}

/** Canonical Intl-supported baseName; language availability and selection are separate concerns. */
export type UiLocale = string

/** The stable identity of built-in English or one extension's translation contribution. */
export type UiTranslationRef =
  | { readonly type: 'builtin'; readonly id: 'en' }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }

/**
 * A UI translation catalog contributed under an extension-local identity.
 *
 * The host binds its actual registering owner.
 */
export interface ExtensionUiTranslationDefinition {
  readonly id: string
  readonly locale: UiLocale
  readonly name: string
  readonly messages: MessageCatalog
}

/** A translation's stable identity, locale and native display name. */
export interface UiTranslation {
  readonly ref: UiTranslationRef
  readonly locale: UiLocale
  readonly name: string
}

/** Translation discovery, instance-owned registration and directory invalidation. */
export interface UiTranslationsApi {
  /**
   * Lists available translation identities and native display names, including built-in English.
   */
  list(call?: CallOptions): Promise<readonly UiTranslation[]>

  /**
   * Validates known messages against the English contract and registers the instance's catalog.
   *
   * Failure preserves existing translations. The returned registration owns removal.
   */
  register(
    input: ExtensionUiTranslationDefinition,
    call?: CallOptions,
  ): Promise<Registration<UiTranslationRef & { readonly type: 'extension' }>>

  /**
   * Subscribes to translation-directory invalidation.
   *
   * A removed translation retains its saved selection while effective language follows fallback
   * rules.
   */
  onInvalidated(listener: () => void): Disposable
}

/**
 * Synchronous access and change notifications for the effective UI locale.
 *
 * Unavailable translations fall back while their saved selection remains unchanged.
 */
export interface UiLocaleApi {
  /** Reads the effective locale, including any active fallback. */
  get(): UiLocale

  /**
   * Subscribes to effective-locale changes.
   *
   * Disposal releases the listener without changing language or saved preferences.
   */
  onChanged(listener: Listener<UiLocale>): Disposable
}

/** UI translation management and effective-locale observation. */
export interface I18nApi {
  readonly translations: UiTranslationsApi
  readonly locale: UiLocaleApi
}

/**
 * Copies a complete catalog's data-only groups and string leaves.
 *
 * Rejects cycles, accessors and invalid path segments. ICU interpretation and product-message
 * compatibility belong to the localization owner.
 */
export function parseMessageCatalog(input: unknown): MessageCatalog {
  const ancestors = new Set<object>()

  /** Copies one message group while tracking ancestor objects to reject cycles. */
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

/** Parses the shared canonical locale syntax and returns its base name without extensions. */
export function parseUiLocale(input: unknown): UiLocale {
  return new Intl.Locale(parseExternalValue(normalizeLocale, input, 'Invalid UI locale')).baseName
}

/** Parses a stable translation identity without resolving owner availability. */
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

/**
 * Parses a translation contribution and canonicalizes its locale.
 *
 * The host separately checks message compatibility against its localization baseline.
 */
export function parseExtensionUiTranslationDefinition(
  input: unknown,
): ExtensionUiTranslationDefinition {
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
