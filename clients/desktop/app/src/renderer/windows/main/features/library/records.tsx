import { type EntryRef } from '@kisaki3/desktop-contracts/library'
import { mdiBookshelf } from '@mdi/js'
import type { MainClient } from '../../../../infrastructure/api'
import type { DialogReceipt } from '../../../../infrastructure/dialogs/presentation'
import { Annotations } from '../../domain-ui/library/records/annotations'
import { Notes } from '../../domain-ui/library/records/notes'
import { PageBar } from '../../domain-ui/page-bar'
import type { LibraryPage } from './navigation'

export function RecordPage(props: {
  api: MainClient
  page: Extract<LibraryPage, { kind: 'notes' | 'annotations' }>
  receipt?: DialogReceipt | undefined
  open: (ref: EntryRef) => void
}) {
  const { api, page } = props,
    t = api.t
  switch (page.kind) {
    case 'annotations':
      return (
        <div class="flex h-full flex-col">
          <PageBar title={t('library.pages.annotations')} icon={mdiBookshelf} />
          <div class="min-h-0 grow overflow-auto p-4">
            <Annotations
              receipt={props.receipt}
              api={api}
              scope={{ type: 'library' }}
              {...(page.ref && { initial: page.ref })}
            />
          </div>
        </div>
      )
    case 'notes':
      return (
        <div class="flex h-full flex-col">
          <PageBar title={t('library.pages.notes')} icon={mdiBookshelf} />
          <div class="min-h-0 grow overflow-auto p-4">
            <Notes
              receipt={props.receipt}
              api={api}
              openEntry={props.open}
              {...(page.id && { initialId: page.id })}
            />
          </div>
        </div>
      )
  }
}
