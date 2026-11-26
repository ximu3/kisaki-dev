import { createSignal, latest, onSettled } from 'solid-js'
import type { PreferencesSnapshot } from '@kisaki3/desktop-contracts/preferences'
import type { MainClient } from '../../../infrastructure/api'
import { createViewQuery } from '../../../infrastructure/query'

export function createPreferencesQuery(api: MainClient) {
  const [committed, accept] = createSignal<PreferencesSnapshot>()
  const query = createViewQuery((signal) => committed() ?? api.request(signal, 'preferences.get'))

  function reload() {
    if (latest(committed) !== undefined) {
      accept(undefined)
    } else {
      void query.reload()
    }
  }

  onSettled(() => {
    api.topics.addEventListener('window.changed', reload)
    return () => api.topics.removeEventListener('window.changed', reload)
  })

  return { result: query.result, pending: query.pending, accept, reload }
}
