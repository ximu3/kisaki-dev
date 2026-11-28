import type { AnnotationRef } from '@kisaki3/desktop-contracts/library'
import type { EntryLocation } from '../../../../../shared/window-api/library'
import { createSignal } from 'solid-js'
import type {
  EntryGroupKey,
  EntryQuery,
  EntryRef,
  CollectionQuery,
  TagQuery,
} from '@kisaki3/desktop-contracts/library'

export type LibraryPage =
  | { kind: 'showcase' }
  | { kind: 'entries'; query: EntryQuery; title: string }
  | { kind: 'collections'; query?: CollectionQuery }
  | { kind: 'tags'; query?: TagQuery }
  | { kind: 'annotations'; ref?: AnnotationRef }
  | { kind: 'notes'; id?: string }
  | {
      kind: 'entry'
      entry: EntryRef
      location?: EntryLocation
      group?: EntryGroupKey
    }

import type { CardAnchor } from '../../domain-ui/library/cards'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../infrastructure/dialogs/presentation'
export function observeVisit(
  receipt: DialogReceipt | undefined,
  read: () => { presented: boolean; error: unknown },
) {
  observeDialogTarget(receipt, read)
}
export interface LibraryVisit {
  receipt?: DialogReceipt
  page: LibraryPage
  section?: string
  card?: CardAnchor
  tab?: string
  browse?: { query: EntryQuery; grid: boolean; offset: number }
  returnTo?: () => void
}
export function createLibraryNavigation() {
  const [visits, setVisits] = createSignal<readonly LibraryVisit[]>([
    { page: { kind: 'showcase' } },
  ])
  const current = () => visits().at(-1)!
  let cancelPending: (() => void) | undefined
  async function present(page: LibraryPage, signal: AbortSignal) {
    signal.throwIfAborted()
    cancelPending?.()
    const result = Promise.withResolvers<void>(),
      visit: LibraryVisit = { page, receipt: { presented: result.resolve, failed: result.reject } }
    const cancel = () =>
      result.reject(new DesktopError('Cancelled', 'The library destination was superseded'))
    cancelPending = cancel
    signal.addEventListener('abort', cancel, { once: true })
    setVisits((list) => [...list, visit])
    try {
      await result.promise
      signal.throwIfAborted()
    } catch (cause) {
      setVisits((list) => list.filter((item) => item !== visit))
      throw cause
    } finally {
      signal.removeEventListener('abort', cancel)
      delete visit.receipt
      if (cancelPending === cancel) {
        cancelPending = undefined
      }
    }
  }
  function open(page: LibraryPage, returnTo?: () => void) {
    if (!returnTo && JSON.stringify(current().page) === JSON.stringify(page)) {
      return
    }
    cancelPending?.()
    setVisits((list) => [...list, { page, ...(returnTo && { returnTo }) }])
  }
  function back() {
    if (visits().length > 1) {
      cancelPending?.()
      const restore = current().returnTo
      setVisits((list) => list.slice(0, -1))
      restore?.()
    }
  }
  return { current, open, present, back, canGoBack: () => visits().length > 1 }
}
export type LibraryNavigation = ReturnType<typeof createLibraryNavigation>
