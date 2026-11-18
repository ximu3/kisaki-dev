/** @fileoverview Reads the full library of selectable user font identities in bounded intervals. */

import { createResource, onCleanup } from 'solid-js'
import type { MainClient } from '../../../../infrastructure/api'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { Font } from '@kisaki3/desktop-contracts/fonts'

/** Identity and display name used when selecting a saved library font. */
export type UserFontOption = Pick<Font, 'id' | 'name'>

/** Reads intervals until the catalog is exhausted, without retaining file metadata. */
async function listFontOptions(
  read: (options: ListOptions) => Promise<ListResult<UserFontOption>>,
) {
  const items: UserFontOption[] = []
  for (;;) {
    const result = await read({ offset: items.length, limit: 200 })
    items.push(...result.items)
    if (items.length >= result.total || !result.items.length) {
      return items
    }
  }
}

/** Keeps library and system choices independent when one font source fails to load. */
export function createFontOptions(api: MainClient) {
  const [users, userActions] = createResource(() =>
    listFontOptions((options) => api.call('fonts.list', '', options)),
  )
  const [system, systemActions] = createResource(() => api.call('fonts.system'))

  const refresh = () => void userActions.refetch()
  api.topics.addEventListener('fonts.changed', refresh)
  onCleanup(() => api.topics.removeEventListener('fonts.changed', refresh))

  function retry() {
    if (users.error) {
      void userActions.refetch()
    }
    if (system.error) {
      void systemActions.refetch()
    }
  }

  return {
    users: () => (users.error ? [] : (users() ?? [])),
    system: () => (system.error ? [] : (system() ?? [])),
    loading: () => users.loading || system.loading,
    error: (): unknown => users.error ?? system.error,
    retry,
  }
}
