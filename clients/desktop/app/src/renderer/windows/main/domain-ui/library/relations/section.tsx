import { createMemo, createSignal, For, Show } from 'solid-js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { mdiPlus, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js'
import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { reportError, errorMessage } from '../../../../../infrastructure/notifications'
import { createConfirmation } from '../../../../../infrastructure/dialogs/confirmation'
import { libraryRead } from '../read'
import { FieldSection } from '../chrome'
import { CatalogCard } from '../cards'
import type { LibraryFact } from '../../../../../../shared/window-api/library'
import { relationViews, roleOf, relatedRef, type RelationTab, type RelationView } from './views'
import { RelationEditor, type RelationEdit } from './editor'

export function RelationSection(props: {
  api: MainClient
  owner: EntryRef
  tab: RelationTab
  mode: 'cards' | 'links' | 'list'
  spoilers: boolean
  open: (ref: EntryRef) => void
  all: () => void
}) {
  const { api } = props,
    t = api.t
  const [manager, setManager] = createSignal(false),
    [edit, setEdit] = createSignal<RelationEdit>()
  const [offset, setOffset] = createSignal(0)
  const confirm = createConfirmation(t)
  const views = createMemo(() => relationViews(props.owner, props.tab))
  const title = () => t(`library.detail.${props.tab}`)
  const read = libraryRead<{
    more: boolean
    rows: {
      fact: LibraryFact
      ref: EntryRef
      view: RelationView
      role: ReturnType<typeof roleOf>
      item: EntryRef & { name: string; primaryImageId: string | null }
    }[]
  }>(api, ['relations', 'entries'], async (signal) => {
    const family = views(),
      offsetNow = manager() || props.mode === 'list' ? offset() : 0
    const count = manager() || props.mode === 'list' ? 50 : 12
    const pages = await Promise.all(
      family.map(async (view) => ({
        view,
        page: await api.request(
          signal,
          'library.relations.list',
          view.family,
          view.scope,
          { offset: offsetNow, limit: count },
          props.spoilers,
        ),
      })),
    )
    const facts = pages.flatMap(({ view, page }) =>
      page.items.flatMap((fact) => {
        const ref = relatedRef(fact, view)
        return ref ? [{ fact, ref, view, role: roleOf(fact, view) } as const] : []
      }),
    )
    const refs = [...new Map(facts.map((row) => [row.ref.id, row.ref])).values()]
    const items = await api.request(signal, 'library.entries.resolveRefs', refs)
    const names = new Map(items.map((item) => [item.id, item]))
    return {
      rows: facts.flatMap((row) => {
        const item = names.get(row.ref.id)
        return item ? [{ ...row, item }] : []
      }),
      more: pages.some(({ page }) => page.total > offsetNow + count),
    }
  })
  const groups = createMemo(() => {
    const roles = new Map<ReturnType<typeof roleOf>, string[]>()
    for (const row of read.result()?.value?.rows ?? []) {
      const group = roles.get(row.role) ?? []
      if (!group.includes(row.ref.id)) {
        group.push(row.ref.id)
      }
      roles.set(row.role, group)
    }
    return [...roles]
  })
  function manage() {
    setOffset(0)
    setManager(true)
  }
  function listing() {
    return (
      <>
        <div class="divide-y divide-border">
          <For each={read.result()?.value?.rows} keyed={(row) => row.fact.id}>
            {(row) => (
              <div class="flex items-center gap-2 py-1.5">
                <button
                  class="me-auto min-w-0 truncate text-start text-sm text-primary hover:underline"
                  onClick={() => props.open(row().ref)}
                >
                  {row().item.name}
                </button>
                <span class="text-xs text-muted-foreground">
                  {t(`library.roles.${row().role}`)}
                </span>
                <span class="min-w-0 truncate text-xs">{row().fact.note}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('actions.editItem', { name: row().item.name })}
                  onClick={() =>
                    setEdit({
                      owner: props.owner,
                      view: row().view,
                      spoilers: props.spoilers,
                      original: row().fact,
                    })
                  }
                >
                  <Icon path={mdiPencilOutline} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('actions.deleteItem', { name: row().item.name })}
                  onClick={() =>
                    void (async () => {
                      const value = row()
                      if (
                        await confirm.ask(t('actions.delete'), t('actions.delete'), value.item.name)
                      ) {
                        await api.call('library.relations.delete', value.view.family, value.fact.id)
                      }
                    })().catch(reportError)
                  }
                >
                  <Icon path={mdiTrashCanOutline} />
                </Button>
              </div>
            )}
          </For>
        </div>
        <Show when={offset() || read.result()?.value?.more}>
          <div class="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!offset()}
              onClick={() => setOffset((i) => Math.max(0, i - 50))}
            >
              {t('actions.previous')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!read.result()?.value?.more}
              onClick={() => setOffset((i) => i + 50)}
            >
              {t('actions.next')}
            </Button>
          </div>
        </Show>
      </>
    )
  }
  return (
    <>
      <FieldSection
        title={title()}
        editLabel={t('actions.editItem', { name: title() })}
        edit={manage}
        actions={
          <Show when={props.mode !== 'list' && read.result()?.value?.more}>
            <Button size="sm" variant="ghost" onClick={props.all}>
              {t('showcase.viewAll')}
            </Button>
          </Show>
        }
      >
        <Show when={read.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
        <Show when={read.result()?.value}>
          {(page) => (
            <Show
              when={page().rows.length}
              fallback={
                <p class="text-xs text-muted-foreground italic">{t('library.detail.empty')}</p>
              }
            >
              <Show when={props.mode === 'cards'}>
                <div class="flex gap-3 overflow-x-auto pb-1">
                  <For each={page().rows}>
                    {(row) => (
                      <div class="w-24 shrink-0">
                        <CatalogCard
                          api={api}
                          item={{
                            target: row.ref,
                            name: row.item.name,
                            image: row.item.primaryImageId,
                          }}
                          showType={false}
                          open={() => props.open(row.ref)}
                        />
                        <span class="rounded-sm bg-muted px-1 text-xs">
                          {t(`library.roles.${row.role}`)}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={props.mode === 'links'}>
                <div class="space-y-2">
                  <For each={groups()}>
                    {([role, ids]) => (
                      <div>
                        <div class="text-xs text-muted-foreground">
                          {t(`library.roles.${role as ReturnType<typeof roleOf>}`)}
                        </div>
                        <div class="flex flex-wrap gap-x-1">
                          <For each={ids}>
                            {(id) => {
                              const row = page().rows.find((row) => row.ref.id === id)!
                              return (
                                <button
                                  class="text-xs font-medium text-primary hover:underline"
                                  onClick={() => props.open(row.ref)}
                                >
                                  {row.item.name}
                                </button>
                              )
                            }}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={props.mode === 'list'}>{listing()}</Show>
            </Show>
          )}
        </Show>
      </FieldSection>
      <Show when={manager()}>
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setManager(false)
              setOffset(0)
            }
          }}
        >
          <DialogContent size="md">
            <DialogHeader closeLabel={t('actions.close')}>
              <DialogTitle>{title()}</DialogTitle>
            </DialogHeader>
            <DialogBody>{listing()}</DialogBody>
            <DialogFooter>
              <Button
                class="me-auto"
                variant="outline"
                onClick={() => {
                  const view = views()[0]
                  if (view) {
                    setEdit({ owner: props.owner, view })
                  }
                }}
              >
                <Icon path={mdiPlus} />
                {t('actions.create')}
              </Button>
              <Button variant="outline" onClick={() => setManager(false)}>
                {t('actions.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Show>
      <RelationEditor api={api} edit={edit()} close={() => setEdit(undefined)} />
      <confirm.Content />
    </>
  )
}
