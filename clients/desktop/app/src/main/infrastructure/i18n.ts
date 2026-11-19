/** @fileoverview Resolves the selected translation against live instance registrations and the built-in English catalog. */

import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { catalogKey } from '../../shared/catalog-ref'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  UiTranslationRef,
  ExtensionUiTranslationDefinition,
  MessageCatalog,
  UiTranslation,
} from '@kisaki3/desktop-contracts/i18n'
import {
  createTranslator,
  validateExtensionUiTranslationDefinition,
} from '@kisaki3/desktop-localization'
import { createSignal } from './events'

/** A listed translation and the message catalog it supplies to the running application. */
type TranslationEntry = UiTranslation & { messages: MessageCatalog }

/** Tracks launch-provided and live instance translations against the saved selection. */
export function createI18n(builtin?: TranslationEntry) {
  const english: TranslationEntry = {
    ref: { type: 'builtin', id: 'en' } as const,
    name: 'English',
    locale: 'en',
    messages: {},
  }
  const translations = new Map([[catalogKey(english.ref), english]])
  if (builtin) {
    translations.set(catalogKey(builtin.ref), builtin)
  }
  /** Signals a change of effective messages, including same-locale replacements. */
  const changed = createSignal<void>()
  /** Notifies translation pickers when a registration appears or disappears. */
  const directory = createSignal<void>()
  let selection: UiTranslationRef = english.ref
  let effective = english
  let translator = createTranslator('en')

  /** Resolves the stable reference after selection, registration or instance release. */
  function adopt() {
    const next = translations.get(catalogKey(selection)) ?? english
    if (effective === next) {
      return
    }
    effective = next
    translator = createTranslator(next.locale, next.messages)
    changed.emit()
  }

  return {
    /** Reads the currently effective catalog and locale. */
    get current() {
      return effective
    },
    /** Reads the formatter bound to the currently adopted messages. */
    get t() {
      return translator
    },
    /** Returns translation names and identities without transferring every catalog. */
    list(options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return [...translations.values()].map(({ ref, name, locale }) => ({
        ref,
        name,
        locale,
      }))
    },
    /** Resolves the selected stable identity against the live registrations. */
    select(ref: UiTranslationRef) {
      selection = ref
      adopt()
    },
    /** Registers a validated catalog under a trusted extension's actual identity. */
    register(
      extensionId: string,
      definition: ExtensionUiTranslationDefinition,
      options?: CallOptions,
    ) {
      options?.signal?.throwIfAborted()
      const value = validateExtensionUiTranslationDefinition(definition)
      const ref = { type: 'extension', extensionId, id: value.id } as const
      const key = catalogKey(ref)
      if (translations.has(key)) {
        throw new DesktopError('Conflict', 'This translation is already registered')
      }
      const entry = { ...value, ref }
      translations.set(key, entry)
      adopt()
      directory.emit()
      return {
        ref,
        /** Removes only the matching instance and recomputes the effective language. */
        dispose() {
          if (translations.get(key) === entry) {
            translations.delete(key)
            adopt()
            directory.emit()
          }
        },
      }
    },
    onChanged: changed.on,
    onInvalidated: directory.on,
  }
}
