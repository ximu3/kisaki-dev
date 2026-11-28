import { onSettled } from 'solid-js'
import type {
  LibraryInvalidation,
  LibraryInvalidationArea,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../infrastructure/api'
import { createViewQuery } from '../../../../infrastructure/query'

export function libraryRead<T>(
  api: MainClient,
  areas: readonly LibraryInvalidationArea[],
  read: (signal: AbortSignal) => Promise<T> | T,
) {
  const query = createViewQuery(read)
  const refresh = () => void query.reload()
  function invalidated(event: Event) {
    const { detail } = event as CustomEvent<LibraryInvalidation>
    if (detail.areas.some((area) => areas.includes(area))) {
      refresh()
    }
  }
  onSettled(() => {
    api.topics.addEventListener('library.invalidated', invalidated)
    api.topics.addEventListener('i18n.changed', refresh)
    return () => {
      api.topics.removeEventListener('library.invalidated', invalidated)
      api.topics.removeEventListener('i18n.changed', refresh)
    }
  })
  return query
}
