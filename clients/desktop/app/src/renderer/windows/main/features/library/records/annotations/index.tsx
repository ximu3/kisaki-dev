import { createSignal, For, Show } from 'solid-js'
import { mdiBookmarkOutline, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import type {
  Annotation,
  AnnotationRef,
  AnnotationScope,
  AnnotationSummary,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { AnnotationDetail } from '../../../../../../domain-ui/annotations/detail'
import { SavedMarkdown } from '../../../../domain-ui/library/images/markdown'
import { LibraryImage } from '../../../../domain-ui/library/image'
import { libraryRead } from '../../../../domain-ui/library/read'
import { AnnotationEditor } from './editor'

import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../../../infrastructure/dialogs/presentation'
export function Annotations(props: {
  receipt?: DialogReceipt | undefined
  api: MainClient
  scope: AnnotationScope
  initial?: AnnotationRef
}) {
  const { api } = props,
    t = api.t,
    confirm = createConfirmation(t)
  const [search, setSearch] = createSignal(''),
    [offset, setOffset] = createSignal(0),
    [view, setView] = createSignal<AnnotationRef | undefined>(props.initial),
    [edit, setEdit] = createSignal<Annotation>()
  const list = libraryRead(api, ['annotations'], (signal) =>
    api.request(
      signal,
      'library.annotations.list',
      { scope: props.scope, search: search() },
      { offset: offset(), limit: 50 },
    ),
  )
  const selected = libraryRead(api, ['annotations'], (signal) =>
    view() ? api.request(signal, 'library.annotations.get', view()!) : null,
  )
  observeDialogTarget(props.receipt, () => {
    const read = props.initial ? selected.result() : list.result()
    return {
      presented: !!read?.value,
      error: read?.error ?? (read?.value === null ? new Error(t('library.noMatch')) : undefined),
    }
  })
  const title = (row: AnnotationSummary) =>
    row.title || row.quoteExcerpt || row.contentExcerpt || t('library.records.annotations')
  async function editing(ref: AnnotationRef) {
    const row = await api.call('library.annotations.get', ref)
    if (row) {
      setEdit(row)
    }
  }
  async function remove(row: AnnotationSummary) {
    if (
      await confirm.ask(
        t('actions.deleteItem', { name: title(row) }),
        t('actions.delete'),
        title(row),
      )
    ) {
      await api.call('library.annotations.delete', row.ref)
    }
  }
  return (
    <section class="space-y-3">
      <SearchInput
        value={search()}
        aria-label={t('controls.search.label')}
        clearLabel={t('controls.search.clear')}
        onValueChange={(v) => {
          setSearch(v)
          setOffset(0)
        }}
      />
      <Show when={list.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
      <Show when={list.result()?.value}>
        {(page) => (
          <>
            <div class="divide-y overflow-hidden rounded-md border">
              <For
                each={page().items}
                fallback={
                  <p class="py-10 text-center text-sm text-muted-foreground">
                    {t('library.detail.noRecords')}
                  </p>
                }
              >
                {(row) => (
                  <div class="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30">
                    <button
                      class="flex min-w-0 grow items-center gap-3 text-start"
                      onClick={() => setView(row.ref)}
                    >
                      <span class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                        <Show
                          when={row.imageId}
                          fallback={<Icon path={mdiBookmarkOutline} class="size-4" />}
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
                          {t(`library.types.${row.work.type}`)} ·{' '}
                          {new Intl.DateTimeFormat(api.locale()).format(row.createdAt)}
                        </span>
                      </span>
                    </button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('actions.edit')}
                      onClick={() => void editing(row.ref).catch(reportError)}
                    >
                      <Icon path={mdiPencilOutline} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('actions.delete')}
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
          </>
        )}
      </Show>
      <Show when={view()}>
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setView(undefined)
            }
          }}
        >
          <DialogContent size="lg">
            <DialogHeader closeLabel={t('actions.close')}>
              <DialogTitle>
                {selected.result()?.value?.title || t('library.records.annotations')}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Show when={selected.result()?.value}>
                {(row) => (
                  <AnnotationDetail
                    t={t}
                    locale={api.locale()}
                    item={row()}
                    image={(id) => (
                      <LibraryImage
                        api={api}
                        id={id}
                        class="max-h-96 w-full rounded-lg object-contain"
                        alt=""
                      />
                    )}
                    markdown={(value) => <SavedMarkdown api={api} value={value} />}
                  />
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
        {(row, g) => (
          <AnnotationEditor
            api={api}
            row={row}
            register={g.registerEditor}
            close={g.requestClose}
            saved={() => setEdit(undefined)}
          />
        )}
      </EditorDialog>
      <confirm.Content />
    </section>
  )
}
