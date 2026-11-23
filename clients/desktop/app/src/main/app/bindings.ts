import { isDeepStrictEqual } from 'node:util'
import { releaseAll } from '../infrastructure/release'
import { createSignal } from '../infrastructure/events'
import type { createPreferences } from '../features/preferences'
import type { createI18n } from '../infrastructure/i18n'
import type { createAppearance } from '../features/appearance'
import type { createNetwork } from '../infrastructure/network'
import type { Preferences } from '@kisaki3/desktop-contracts/preferences'

/** Establishes all fixed subscriptions and applies the initial choices before any document or business is admitted. */
export async function bindSettings(
  preferences: ReturnType<typeof createPreferences>,
  defaults: Preferences,
  i18n: ReturnType<typeof createI18n>,
  appearance: ReturnType<typeof createAppearance>,
  network: ReturnType<typeof createNetwork>,
  adoptLocale: (locale: string) => Promise<void>,
) {
  const updated = createSignal<void>()
  let saved = await preferences.get()
  let applying = Promise.resolve()

  async function adopt(value: typeof saved, initial = false) {
    const old = saved
    saved = value
    if (initial || !isDeepStrictEqual(old.general.uiTranslation, value.general.uiTranslation)) {
      i18n.select(
        value.general.uiTranslation.status === 'ready'
          ? value.general.uiTranslation.value
          : defaults.general.uiTranslation,
      )
    }

    if (initial || !isDeepStrictEqual(old.appearance, value.appearance)) {
      appearance.select({
        ...value.appearance,
        theme:
          value.appearance.theme.status === 'ready'
            ? value.appearance.theme.value
            : defaults.appearance.theme,
      })
    }

    if (initial || !isDeepStrictEqual(old.network, value.network)) {
      await network.apply(value.network)
    }
    updated.emit()
  }

  const locale = i18n.onChanged(() => {
    applying = applying
      .then(() => adoptLocale(i18n.current.locale))
      .then(() => updated.emit())
      .catch(console.error)
  })
  const settings = preferences.onInvalidated(() => {
    applying = applying.then(async () => adopt(await preferences.get())).catch(console.error)
  })

  /** Unsubscribes after admission has stopped and waits for the final adoption work. */
  async function dispose() {
    await releaseAll([() => settings.dispose(), () => locale.dispose(), () => applying])
  }

  const presentationDeadline = Date.now() + 5_000
  try {
    await adopt(saved, true)
    await adoptLocale(i18n.current.locale)
  } catch (error) {
    await dispose()
    throw error
  }

  return {
    presentationDeadline,
    onUpdated: updated.on,
    get saved() {
      return saved
    },

    /** Waits for queued settings and name-index adoption. */
    settled: () => applying,
    dispose,
  }
}
