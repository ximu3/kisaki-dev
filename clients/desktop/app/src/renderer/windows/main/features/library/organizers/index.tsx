import { createSignal, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiPlus, mdiFolderOutline, mdiTagOutline } from '@mdi/js'
import type { CollectionQuery, TagQuery, EntryQuery } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { PageBar } from '../../../domain-ui/library/chrome'
import { readCards, locateCard, CardShelf } from '../../../domain-ui/library/cards'
import { browseQuery } from '../../../domain-ui/library/entries/query'
import { OrganizerEditor, type OrganizerEdit } from './editor'

import { OrganizerManager } from './manager'
import type { LibraryVisit } from '../navigation'
export function Organizers(props: {
  api: MainClient
  visit?: LibraryVisit | undefined
  kind: 'collection' | 'tag'
  query?: CollectionQuery | TagQuery | undefined
  open: (query: EntryQuery, title: string) => void
}) {
  const { api } = props,
    t = api.t
  const [manage, setManage] = createSignal(false)
  const [edit, setEdit] = createSignal<OrganizerEdit>(),
    [root, setRoot] = createSignal<HTMLDivElement>()
  const query = () => ({
    ...props.query,
    kind: props.kind,
    search: props.query?.search ?? '',
    sort: props.query?.sort ?? { type: 'scope' as const },
  })
  const previous = props.visit?.card
  const title = () =>
    t(props.kind === 'collection' ? 'library.pages.collections' : 'library.pages.tags')
  return (
    <section class="flex h-full min-h-0 flex-col">
      <PageBar
        title={title()}
        icon={props.kind === 'collection' ? mdiFolderOutline : mdiTagOutline}
      >
        <Button size="sm" variant="outline" onClick={() => setManage(true)}>
          {t('actions.manage')}
        </Button>
        <Button size="sm" onClick={() => setEdit({ kind: props.kind })}>
          <Icon path={mdiPlus} />
          {t(
            props.kind === 'collection'
              ? 'library.organize.newCollection'
              : 'library.organize.newTag',
          )}
        </Button>
      </PageBar>
      <div ref={setRoot} class="min-h-0 grow overflow-auto p-4">
        <Show when={root()}>
          {(viewport) => (
            <CardShelf
              receipt={props.visit?.receipt}
              api={api}
              viewport={viewport()}
              size="md"
              square
              layout="grid"
              limit={null}
              source={JSON.stringify(query())}
              restore={
                previous
                  ? {
                      anchor: previous,
                      locate: (signal) => locateCard(api, query(), previous.target, signal),
                    }
                  : undefined
              }
              remember={(anchor) => {
                if (props.visit) {
                  props.visit.card = anchor
                }
              }}
              read={(range, signal) => readCards(api, query(), range, signal)}
              showType={false}
              open={(item) =>
                props.open(browseQuery({ type: props.kind, id: item.target.id }), item.name)
              }
            />
          )}
        </Show>
      </div>
      <Show when={manage()}>
        <OrganizerManager
          api={api}
          kind={props.kind}
          edit={setEdit}
          close={() => setManage(false)}
        />
      </Show>
      <OrganizerEditor api={api} edit={edit()} close={() => setEdit(undefined)} />
    </section>
  )
}
