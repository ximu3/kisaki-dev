import { createPreferencesQuery } from '../domain-ui/preferences-query'
import { createEffect } from 'solid-js'
import type { PreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import type { MainClient } from '../../../infrastructure/api'
import { reportError } from '../../../infrastructure/notifications'

export function createShellPreferences(api: MainClient) {
  const preferences = createPreferencesQuery(api)
  const current = () => preferences.result()?.value

  createEffect(
    () => preferences.result()?.error,
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
