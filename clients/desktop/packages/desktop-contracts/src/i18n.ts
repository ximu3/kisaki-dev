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

export type UiTranslationRef =
  | { readonly type: 'builtin'; readonly id: 'en' | 'zh-Hans' }
  | { readonly type: 'extension'; readonly extensionId: string; readonly id: string }

/** The host binds its actual registering owner. */
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
   * A removed translation retains its saved selection while effective language follows fallback
   * rules.
   */
  onInvalidated(listener: () => void): Disposable
}

/** Unavailable translations fall back while their saved selection remains unchanged. */
export interface UiLocaleApi {
  /** Reads the effective locale, including any active fallback. */
  get(): UiLocale

  /** Disposal releases the listener without changing language or saved preferences. */
  onChanged(listener: Listener<UiLocale>): Disposable
}

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

/** Canonicalizes the locale. The host checks message compatibility against its baseline. */
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
