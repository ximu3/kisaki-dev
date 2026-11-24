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

type TranslationEntry = UiTranslation & { messages: MessageCatalog }

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
  const messagesChanged = createSignal<void>()
  const catalogInvalidated = createSignal<void>()
  let selection: UiTranslationRef = english.ref
  let effective = english
  let translator = createTranslator('en')

  function adopt() {
    const next = translations.get(catalogKey(selection)) ?? english
    // Two catalogs may use the same locale but supply different messages.
    if (effective === next) {
      return
    }
    effective = next
    translator = createTranslator(next.locale, next.messages)
    messagesChanged.emit()
  }

  return {
    get current() {
      return effective
    },
    get t() {
      return translator
    },

    list(options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return [...translations.values()].map(({ ref, name, locale }) => ({
        ref,
        name,
        locale,
      }))
    },

    select(ref: UiTranslationRef) {
      selection = ref
      adopt()
    },

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
      catalogInvalidated.emit()

      return {
        ref,
        dispose() {
          if (translations.get(key) === entry) {
            translations.delete(key)
            adopt()
            catalogInvalidated.emit()
          }
        },
      }
    },
    onChanged: messagesChanged.on,
    onInvalidated: catalogInvalidated.on,
  }
}
