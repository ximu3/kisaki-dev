import { createSignal, For, Match, Show, Switch } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiCogOutline, mdiPlus, mdiViewDashboardOutline } from '@mdi/js'
import type { ShowcaseQuery, ShowcaseFields } from '@kisaki3/desktop-contracts/library'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import { errorMessage } from '../../../../../infrastructure/notifications'
import type { MainClient } from '../../../../../infrastructure/api'
import { PageBar } from '../../../domain-ui/library/chrome'
import { libraryRead } from '../../../domain-ui/library/read'
import { readCards, locateCard, CardShelf, type CardItem } from '../../../domain-ui/library/cards'
import { selectedTypes } from '../../../domain-ui/library/query'
import type { SectionEdit } from './model'
import { SectionEditor } from './editor'
import { SectionManager } from './manager'

import { observeVisit, type LibraryVisit } from '../navigation'
export function Showcase(props: {
  api: MainClient
  visit?: LibraryVisit | undefined
  open: (item: CardItem, mode: ShowcaseFields['openMode']) => void
  all: (query: ShowcaseQuery, title: string) => void
}) {
  const { api, visit } = props
  const previous = visit?.card,
    section = visit?.section
  const t = api.t
  const sections = libraryRead(api, ['showcase'], (signal) =>
    api.request(signal, 'library.showcase.list'),
  )
  const presets = libraryRead(api, ['showcase'], (signal) =>
    api.request(signal, 'library.showcase.listPresets'),
  )
  observeVisit(visit?.receipt, () => ({
    presented: !!sections.result()?.value,
    error: sections.result()?.error,
  }))
  const visible = () => sections.result()?.value?.filter((section) => section.isVisible)
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
  const [manage, setManage] = createSignal(false)
  const [edit, setEdit] = createSignal<SectionEdit>()

  return (
    <div class="flex h-full min-h-0 flex-col">
      <PageBar title={t('library.pages.showcase')} icon={mdiViewDashboardOutline}>
        <Button size="sm" variant="ghost" onClick={() => setManage(true)}>
          <Icon class="size-4" path={mdiCogOutline} />
          {t('showcase.manage')}
        </Button>
      </PageBar>
      <div class="min-h-0 grow overflow-auto bg-background" ref={setViewport}>
        <Switch>
          <Match when={sections.result()?.error}>
            {(cause) => (
              <EmptyState
                class="h-full"
                heading={t('controls.feedback.unavailable')}
                description={errorMessage(cause())}
              >
                <Button variant="outline" onClick={() => void sections.reload()}>
                  {t('actions.retry')}
                </Button>
              </EmptyState>
            )}
          </Match>
          <Match when={visible()?.length === 0}>
            <EmptyState
              class="h-full p-8"
              icon={<Icon path={mdiViewDashboardOutline} />}
              heading={t('showcase.empty')}
            >
              <Button onClick={() => setManage(true)}>
                <Icon path={mdiPlus} />
                {t('showcase.first')}
              </Button>
            </EmptyState>
          </Match>
          <Match when={viewport()}>
            {(root) => (
              <div class="space-y-4 p-4">
                <For each={visible()} keyed={(row) => row.id}>
                  {(row) => {
                    const query = () => {
                      const q = row().query
                      return q.status === 'ready' ? q.value : undefined
                    }
                    const error = () => {
                      const q = row().query
                      return q.status === 'invalid' ? q.error.message : undefined
                    }
                    return (
                      <Show
                        when={query()}
                        fallback={
                          <section>
                            <h3>{row().name}</h3>
                            <p role="alert">{error()}</p>
                            <Button variant="outline" onClick={() => setEdit({ saved: row() })}>
                              {t('actions.edit')}
                            </Button>
                          </section>
                        }
                      >
                        {(q) => (
                          <CardShelf
                            api={api}
                            viewport={root()}
                            title={row().name}
                            size={row().itemSize}
                            layout={row().layout}
                            square={q().kind !== 'entry'}
                            limit={row().limit}
                            source={JSON.stringify(q())}
                            reveal={section === row().id}
                            restore={
                              section === row().id && previous
                                ? {
                                    anchor: previous,
                                    locate: (signal) =>
                                      locateCard(api, q(), previous.target, signal),
                                  }
                                : undefined
                            }
                            remember={(anchor) => {
                              if (visit) {
                                visit.section = row().id
                                visit.card = anchor
                              }
                            }}
                            read={(range, signal) => readCards(api, q(), range, signal)}
                            open={(item) => props.open(item, row().openMode)}
                            showType={(() => {
                              const query = q()
                              return query.kind === 'entry' && selectedTypes(query).size > 1
                            })()}
                            all={() => {
                              if (visit) {
                                visit.section = row().id
                                delete visit.card
                              }
                              props.all(q(), row().name)
                            }}
                            edit={() => setEdit({ saved: row() })}
                          />
                        )}
                      </Show>
                    )
                  }}
                </For>
              </div>
            )}
          </Match>
        </Switch>
      </div>
      <Show when={manage()}>
        <SectionManager
          api={api}
          sections={sections.result()?.value ?? []}
          presets={presets.result()?.value ?? []}
          edit={setEdit}
          close={() => setManage(false)}
        />
      </Show>
      <EditorDialog edit={edit()} size="md" onClose={() => setEdit(undefined)}>
        {(initial, controls) => (
          <SectionEditor
            api={api}
            edit={initial}
            presets={presets.result()?.value ?? []}
            register={controls.registerEditor}
            close={controls.requestClose}
            saved={() => setEdit(undefined)}
          />
        )}
      </EditorDialog>
    </div>
  )
}
