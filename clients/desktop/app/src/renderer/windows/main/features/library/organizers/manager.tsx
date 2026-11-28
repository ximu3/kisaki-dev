import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from '@kisaki3/desktop-ui/menu'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { mdiDotsHorizontal } from '@mdi/js'
import type { MainClient } from '../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../infrastructure/dialogs/confirmation'
import { errorMessage, reportError } from '../../../../../infrastructure/notifications'
import { libraryRead } from '../../../domain-ui/library/read'
import type { OrganizerEdit } from './editor'
import { Members } from './members'
export function OrganizerManager(props: {
  api: MainClient
  kind: 'collection' | 'tag'
  edit: (item: OrganizerEdit) => void
  close: () => void
}) {
  const { api, kind } = props,
    t = api.t,
    confirm = createConfirmation(t),
    [term, setTerm] = createSignal(''),
    [offset, setOffset] = createSignal(0),
    [selected, setSelected] = createSignal<{ id: string; name: string }>(),
    [source, setSource] = createSignal<{ id: string; name: string }>()
  const read = libraryRead(api, ['collections', 'tags'], (signal) =>
    api.request(
      signal,
      kind === 'collection' ? 'library.collections.list' : 'library.tags.list',
      { search: term(), sort: { type: 'scope' } },
      { offset: offset(), limit: 50 },
    ),
  )
  const get = (id: string) =>
    api.call(kind === 'collection' ? 'library.collections.get' : 'library.tags.get', id)
  async function edit(id: string) {
    const row = await get(id)
    if (row) {
      props.edit({ kind, original: row })
    }
  }
  async function remove(id: string, name: string) {
    if (await confirm.ask(t('actions.deleteItem', { name }), t('actions.delete'), name)) {
      await api.call(
        kind === 'collection' ? 'library.collections.delete' : 'library.tags.delete',
        id,
      )
    }
  }
  async function convert(id: string) {
    const row = await api.call('library.collections.get', id)
    if (
      row?.membershipMode === 'dynamic' &&
      row.dynamicRules.status === 'ready' &&
      (await confirm.ask(t('library.organize.manual'), t('actions.confirm'), row.name))
    ) {
      await api.call('library.collections.convertToManual', id, row.dynamicRules.value)
    }
  }
  async function merge(targetId: string, name: string) {
    const selected = source()
    if (!selected) {
      return
    }
    if (
      await confirm.ask(
        t('library.entryActions.merge'),
        t('actions.confirm'),
        selected.name + ' → ' + name,
      )
    ) {
      await api.call('library.organizers.merge', kind, { sourceIds: [selected.id], targetId })
      setSource(undefined)
    }
  }
  async function move(id: string, index: number, d: number) {
    const rank = offset() + index,
      slot = d < 0 ? rank - 1 : rank + 2
    if (slot < 0) {
      return
    }
    const next = await api.call(
      'library.collections.list',
      { search: term(), sort: { type: 'scope' } },
      { offset: slot, limit: 1 },
    )
    await api.call('library.collections.move', { ids: [id], before: next.items[0]?.id ?? null })
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(v) => {
          if (!v) {
            props.close()
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader closeLabel={t('actions.close')}>
            <DialogTitle>
              {t(kind === 'collection' ? 'library.pages.collections' : 'library.pages.tags')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody class="space-y-2">
            <SearchInput
              value={term()}
              aria-label={t('controls.search.label')}
              clearLabel={t('controls.search.clear')}
              onValueChange={(v) => {
                setTerm(v)
                setOffset(0)
              }}
            />
            <Show when={source()}>
              {(v) => (
                <div class="flex items-center justify-between text-sm">
                  {t('library.entryActions.survivor')} · {v().name}
                  <Button variant="ghost" size="sm" onClick={() => setSource(undefined)}>
                    {t('actions.cancel')}
                  </Button>
                </div>
              )}
            </Show>
            <Show when={read.result()?.error}>
              {(e) => <p role="alert">{errorMessage(e())}</p>}
            </Show>
            <Show when={read.result()?.value}>
              {(page) => (
                <>
                  <For each={page().items}>
                    {(row, i) => (
                      <div class="flex items-center gap-1 rounded px-2 py-1 hover:bg-accent">
                        <Button
                          disabled={source()?.id === row.id}
                          class="min-w-0 grow justify-start"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void (source() ? merge(row.id, row.name) : edit(row.id)).catch(
                              reportError,
                            )
                          }
                        >
                          {row.name}
                        </Button>
                        <Menu>
                          <MenuTrigger
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t('actions.more') + ' · ' + row.name}
                          >
                            <Icon path={mdiDotsHorizontal} />
                          </MenuTrigger>
                          <MenuContent placement="bottom-end">
                            <MenuItem onSelect={() => void edit(row.id).catch(reportError)}>
                              {t('actions.edit')}
                            </MenuItem>
                            <Show
                              when={'membershipMode' in row && row.membershipMode === 'dynamic'}
                              fallback={
                                <MenuItem onSelect={() => setSelected(row)}>
                                  {t('library.organize.members')}
                                </MenuItem>
                              }
                            >
                              <MenuItem onSelect={() => void convert(row.id).catch(reportError)}>
                                {t('library.organize.manual')}
                              </MenuItem>
                            </Show>
                            <MenuItem
                              disabled={'membershipMode' in row && row.membershipMode === 'dynamic'}
                              onSelect={() => setSource(row)}
                            >
                              {t('library.entryActions.merge')}
                            </MenuItem>
                            <Show when={kind === 'collection'}>
                              <For each={[-1, 1]}>
                                {(d) => (
                                  <MenuItem
                                    disabled={
                                      i() + offset() + d < 0 || i() + offset() + d >= page().total
                                    }
                                    onSelect={() => void move(row.id, i(), d).catch(reportError)}
                                  >
                                    {t(d < 0 ? 'actions.moveUp' : 'actions.moveDown')}
                                  </MenuItem>
                                )}
                              </For>
                            </Show>
                            <MenuSeparator />
                            <MenuItem
                              onSelect={() => void remove(row.id, row.name).catch(reportError)}
                            >
                              {t('actions.delete')}
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </div>
                    )}
                  </For>
                  <Show when={page().total > 50}>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!offset()}
                      onClick={() => setOffset((v) => v - 50)}
                    >
                      {t('actions.previous')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={offset() + 50 >= page().total}
                      onClick={() => setOffset((v) => v + 50)}
                    >
                      {t('actions.next')}
                    </Button>
                  </Show>
                </>
              )}
            </Show>
          </DialogBody>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              class="me-auto"
              onClick={() => props.edit({ kind })}
            >
              {t('actions.create')}
            </Button>
            <Button variant="ghost" onClick={props.close}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Show when={selected()}>
        {(row) => (
          <Members api={api} owner={{ kind, ...row() }} close={() => setSelected(undefined)} />
        )}
      </Show>
      <confirm.Content />
    </>
  )
}
