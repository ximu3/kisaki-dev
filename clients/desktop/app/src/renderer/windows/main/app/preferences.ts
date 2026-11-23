/** @fileoverview Provides saved preferences to the main window's menu, page order and shortcuts. */

import { createEffect, onCleanup } from 'solid-js'
import type { PreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'
import { reportError } from '../../../infrastructure/notifications'
import { createQuery } from '../../../infrastructure/query'

/** Reads the saved snapshot while the shell is mounted and adopts its completed writes. */
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

  /** Adopts the main process's saved values before the caller resumes. */
  async function update(input: PreferencesUpdate) {
    preferences.accept(await api.call('preferences.update', input))
  }

  /** Compares the previous saved order when the rail commits a move. */
  async function reorder(order: readonly PageRef[]) {
    const old = current()?.navigation.order
    await update({
      changes: { navigation: { order } },
      ...(old?.status === 'ready' && { expected: { navigation: { order: old.value } } }),
    })
  }

  return { current, update, reorder }
}
