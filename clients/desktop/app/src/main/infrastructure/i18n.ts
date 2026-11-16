/** @fileoverview Resolves the selected translation against live instance registrations and the built-in English catalog. */

import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  UiTranslationRef,
  ExtensionUiTranslationDefinition,
  MessageCatalog,
} from '@kisaki3/desktop-contracts/i18n'
import {
  createTranslator,
  validateExtensionUiTranslationDefinition,
} from '@kisaki3/desktop-localization'
import { createSignal } from './events'

/** Tracks accepted translation resources without changing the user's durable selection. */
export function createI18n() {
  const english = {
    ref: { type: 'builtin', id: 'en' } as const,
    name: 'English',
    locale: 'en',
    messages: {} as MessageCatalog,
  }
  const translations = new Map<
    string,
    typeof english | (ExtensionUiTranslationDefinition & { ref: UiTranslationRef })
  >()
  /** Signals a change of effective messages, including same-locale replacements. */
  const changed = createSignal<void>()
  /** Notifies translation pickers when a registration appears or disappears. */
  const directory = createSignal<void>()
  let selection: UiTranslationRef = english.ref
  let effective: { ref: UiTranslationRef; name: string; locale: string; messages: MessageCatalog } =
    english
  let translator = createTranslator('en')

  /** Resolves the stable reference after selection, registration or instance release. */
  function adopt() {
    const next = translations.get(JSON.stringify(selection)) ?? english
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
    list() {
      return [english, ...translations.values()].map(({ ref, name, locale }) => ({
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
    register(extensionId: string, definition: ExtensionUiTranslationDefinition) {
      const value = validateExtensionUiTranslationDefinition(definition)
      const ref = { type: 'extension', extensionId, id: value.id } as const
      const key = JSON.stringify(ref)
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
