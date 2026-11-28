import type { EntryRef, Note, NoteQuery, NoteSummary } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { mdiNoteTextOutline, mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../../../infrastructure/dialogs/presentation'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { LibraryImage } from '../../images/image'
import { SavedMarkdown } from '../../images/markdown'
import { libraryRead } from '../../read'
import { NoteEditor, type NoteEdit } from './editor'

export function Notes(props: {
  receipt?: DialogReceipt | undefined
  api: MainClient
  entry?: EntryRef
  openEntry: (ref: EntryRef) => void
  initialId?: string
}) {
  const { api } = props,
    t = api.t,
    confirm = createConfirmation(t)
  const [search, setSearch] = createSignal(''),
    [offset, setOffset] = createSignal(0),
    [unlinked, setUnlinked] = createSignal(false)
  const scope = (): NoteQuery['scope'] =>
    props.entry
      ? { type: 'entry', entry: props.entry }
      : { type: unlinked() ? 'unassociated' : 'library' }
  const read = libraryRead(api, ['notes'], (signal) =>
    api.request(
      signal,
      'library.notes.list',
      { scope: scope(), search: search() },
      { offset: offset(), limit: 50 },
    ),
  )
  const [edit, setEdit] = createSignal<NoteEdit>(),
    [view, setView] = createSignal<string | undefined>(props.initialId)
  async function details(id: string, signal?: AbortSignal) {
    const [note, first] = await Promise.all([
      api.request(signal, 'library.notes.get', id),
      api.request(signal, 'library.notes.entries', id, { offset: 0, limit: 200 }),
    ])
    if (!note) {
      return null
    }
    const entries = [...first.items]
    while (entries.length < first.total) {
      const more = await api.request(signal, 'library.notes.entries', id, {
        offset: entries.length,
        limit: 200,
      })
      if (!more.items.length) {
        break
      }
      entries.push(...more.items)
    }
    return { note, entries }
  }
  const selected = libraryRead(api, ['notes'], (signal) =>
    view() ? details(view()!, signal) : null,
  )
  observeDialogTarget(props.receipt, () => {
    const value = props.initialId ? selected.result() : read.result()
    return {
      presented: !!value?.value,
      error: value?.error ?? (value?.value === null ? new Error(t('library.noMatch')) : undefined),
    }
  })
  const names = libraryRead(api, ['notes', 'entries'], async (signal) => {
    const rows = selected.result()?.value?.entries ?? [],
      items = []
    for (let i = 0; i < rows.length; i += 200) {
      items.push(
        ...(await api.request(signal, 'library.entries.resolveRefs', rows.slice(i, i + 200))),
      )
    }
    return items
  })
  function title(row: NoteSummary | Note) {
    return (
      row.title || ('contentExcerpt' in row && row.contentExcerpt) || t('library.records.untitled')
    )
  }
  async function editing(id: string) {
    const data = await details(id)
    if (data) {
      setEdit(data)
    }
  }
  async function remove(row: NoteSummary) {
    if (await confirm.ask(t('library.records.deleteNote'), t('actions.delete'), title(row))) {
      await api.call('library.notes.delete', row.id)
    }
  }
  function add() {
    setEdit({ entries: props.entry ? [props.entry] : [] })
  }
  return (
    <div class="space-y-3">
      <Show when={!props.entry || read.result()?.value?.total || search()}>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={add}>
            <Icon path={mdiPlus} />
            {t('library.records.newNote')}
          </Button>
          <SearchInput
            class="min-w-0 grow"
            value={search()}
            aria-label={t('controls.search.label')}
            clearLabel={t('controls.search.clear')}
            onValueChange={(v) => {
              setSearch(v)
              setOffset(0)
            }}
          />
          <Show when={!props.entry}>
            <Button
              size="sm"
              variant={unlinked() ? 'secondary' : 'ghost'}
              onClick={() => {
                setUnlinked((v) => !v)
                setOffset(0)
              }}
            >
              {t('library.records.unassociated')}
            </Button>
          </Show>
        </div>
      </Show>
      <Show when={read.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
      <Show when={read.result()?.value}>
        {(page) => (
          <Show
            when={page().items.length}
            fallback={
              <div class="grid justify-items-center gap-3 py-12 text-muted-foreground">
                <Icon path={mdiNoteTextOutline} class="size-8" />
                <p class="text-sm">{t('library.detail.noRecords')}</p>
                <Show when={props.entry && !search()}>
                  <Button onClick={add}>
                    <Icon path={mdiPlus} />
                    {t('library.records.newNote')}
                  </Button>
                </Show>
              </div>
            }
          >
            <div class="divide-y overflow-hidden rounded-md border">
              <For each={page().items}>
                {(row) => (
                  <div class="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent/30">
                    <button
                      class="flex min-w-0 grow items-center gap-3 text-start"
                      onClick={() => setView(row.id)}
                    >
                      <span class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                        <Show
                          when={row.primaryImageId}
                          fallback={
                            <Icon
                              path={mdiNoteTextOutline}
                              class="size-4 text-muted-foreground/50"
                            />
                          }
                        >
                          {(id) => (
                            <LibraryImage
                              api={api}
                              id={id()}
                              class="size-full object-cover"
                              alt=""
                            />
                          )}
                        </Show>
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-medium">{title(row)}</span>
                        <span class="block text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat(api.locale()).format(row.updatedAt)}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('actions.editItem', { name: title(row) })}
                      onClick={() => void editing(row.id).catch(reportError)}
                    >
                      <Icon path={mdiPencilOutline} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('actions.deleteItem', { name: title(row) })}
                      onClick={() => void remove(row).catch(reportError)}
                    >
                      <Icon path={mdiTrashCanOutline} />
                    </Button>
                  </div>
                )}
              </For>
            </div>
            <Show when={page().total > 50}>
              <div class="flex justify-end gap-2">
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
              </div>
            </Show>
          </Show>
        )}
      </Show>
      <Show when={view()}>
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setView(undefined)
            }
          }}
        >
          <DialogContent size="lg">
            <DialogHeader closeLabel={t('actions.close')}>
              <DialogTitle>
                {selected.result()?.value?.note.title ?? t('library.records.viewNote')}
              </DialogTitle>
            </DialogHeader>
            <DialogBody class="space-y-3">
              <Show when={selected.result()?.value}>
                {(data) => (
                  <>
                    <Show when={data().note.primaryImageId}>
                      {(id) => (
                        <LibraryImage
                          api={api}
                          id={id()}
                          class="max-h-48 max-w-full rounded-md object-contain"
                          alt={t('library.records.cover')}
                        />
                      )}
                    </Show>
                    <SavedMarkdown api={api} value={data().note.content} />
                    <div class="flex flex-wrap gap-1">
                      <For each={names.result()?.value}>
                        {(entry) => (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setView(undefined)
                              props.openEntry(entry)
                            }}
                          >
                            {entry.name}
                          </Button>
                        )}
                      </For>
                    </div>
                  </>
                )}
              </Show>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => void editing(view()!).catch(reportError)}>
                {t('actions.edit')}
              </Button>
              <Button variant="ghost" onClick={() => setView(undefined)}>
                {t('actions.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Show>
      <EditorDialog edit={edit()} size="lg" onClose={() => setEdit(undefined)}>
        {(value, guard) => (
          <NoteEditor
            api={api}
            edit={value}
            close={guard.requestClose}
            register={guard.registerEditor}
            saved={() => setEdit(undefined)}
          />
        )}
      </EditorDialog>
      <confirm.Content />
    </div>
  )
}
