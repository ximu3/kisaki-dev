import { createEffect, onCleanup } from 'solid-js'
import type { PreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import type { MainClient } from '../../../infrastructure/api'
import { reportError } from '../../../infrastructure/notifications'
import { createQuery } from '../../../infrastructure/query'

export function createShellPreferences(api: MainClient) {
  const preferences = createQuery((signal) => api.request(signal, 'preferences.get'))
  const current = () => (preferences.error ? undefined : preferences.value)

  const reload = () => void preferences.reload()
  api.topics.addEventListener('window.changed', reload)
  onCleanup(() => api.topics.removeEventListener('window.changed', reload))
  createEffect(
    () => preferences.error,
    (error) => {
      if (error) {
        reportError(error)
      }
    },
  )

  async function update(input: PreferencesUpdate) {
    preferences.accept(await api.call('preferences.update', input))
  }

  return { current, update }
}
