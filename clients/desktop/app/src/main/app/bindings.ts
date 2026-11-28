import type { Preferences } from '@kisaki3/desktop-contracts/preferences'
import { powerMonitor } from 'electron'
import { isDeepStrictEqual } from 'node:util'
import type { createAppearance } from '../features/appearance'
import type { createLibrary } from '../features/library'
import type { createPreferences } from '../features/preferences'
import type { createSessionRegistry } from '../features/sessions/registry'
import type { createEvents } from '../infrastructure/events'
import { createSignal } from '../infrastructure/events'
import type { createI18n } from '../infrastructure/i18n'
import type { createNetwork } from '../infrastructure/network'
import { releaseAll, rethrowAfterRelease } from '../infrastructure/release'

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

  async function dispose() {
    await releaseAll([() => settings.dispose(), () => locale.dispose(), () => applying])
  }

  const presentationDeadline = Date.now() + 5_000
  try {
    await adopt(saved, true)
    await adoptLocale(i18n.current.locale)
  } catch (error) {
    return rethrowAfterRelease(error, dispose)
  }

  return {
    presentationDeadline,
    onUpdated: updated.on,
    get saved() {
      return saved
    },

    settled: () => applying,
    dispose,
  }
}

export function bindLibrary(
  library: ReturnType<typeof createLibrary>,
  bindings: Awaited<ReturnType<typeof bindSettings>>,
  events: ReturnType<typeof createEvents>,
  sessions: ReturnType<typeof createSessionRegistry>,
  report: (cause: unknown) => void,
) {
  const watch = library.holdings.watch(report)
  let sensitive = bindings.saved.library.showNsfw
  function monitor() {
    watch.setEnabled(bindings.saved.library.autoRefreshHoldings)
    if (sensitive !== bindings.saved.library.showNsfw) {
      sensitive = bindings.saved.library.showNsfw
      library.visibilityChanged()
    }
  }
  const observed = [
    bindings.onUpdated(monitor),
    library.holdings.onAutomaticEnabled(watch.matchFile),
    library.holdings.onLocationsChanged(() => void watch.sync()),
    library.holdings.onRulesChanged((rule) => watch.rulesChanged(rule)),
    events.on('library.changed', (event) => watch.libraryChanged(event.changes)),
    sessions.onReleased((ref) => watch.released(ref)),
  ]
  const resume = () => watch.resume()
  powerMonitor.on('resume', resume)
  monitor()
  return async () => {
    powerMonitor.off('resume', resume)
    for (const subscription of observed) {
      await subscription.dispose()
    }
    await watch.close()
  }
}
