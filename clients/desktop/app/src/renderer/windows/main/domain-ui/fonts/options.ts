import { onSettled } from 'solid-js'
import { createViewQuery } from '../../../../infrastructure/query'
import type { MainClient } from '../../../../infrastructure/api'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { Font } from '@kisaki3/desktop-contracts/fonts'

export type UserFontOption = Pick<Font, 'id' | 'name'>

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

export function createFontOptions(api: MainClient) {
  const users = createViewQuery((signal) =>
    listFontOptions((options) => api.request(signal, 'fonts.list', '', options)),
  )
  const system = createViewQuery((signal) => api.request(signal, 'fonts.system'))

  const refresh = () => void users.reload()
  onSettled(() => {
    api.topics.addEventListener('fonts.changed', refresh)
    return () => api.topics.removeEventListener('fonts.changed', refresh)
  })

  function retry() {
    if (users.result()?.error) {
      void users.reload()
    }
    if (system.result()?.error) {
      void system.reload()
    }
  }

  return {
    users: () => users.result()?.value ?? [],
    system: () => system.result()?.value ?? [],
    loading: () => users.pending() || system.pending(),
    error: (): unknown => users.result()?.error ?? system.result()?.error,
    retry,
  }
}
