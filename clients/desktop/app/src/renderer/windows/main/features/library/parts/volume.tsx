import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Input, SearchInput } from '@kisaki3/desktop-ui/input'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import type { PartDetails, VolumeChapter, PartRef } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { libraryRead } from '../../../domain-ui/library/read'
import { errorMessage, reportError } from '../../../../../infrastructure/notifications'

export function VolumeChapters(props: { api: MainClient; volume: PartDetails; close: () => void }) {
  const { api, volume } = props,
    t = api.t
  const [offset, setOffset] = createSignal(0),
    [picking, setPicking] = createSignal(false),
    [search, setSearch] = createSignal(''),
    [pickOffset, setPickOffset] = createSignal(0)
  const list = libraryRead(api, ['parts'], async (signal) => {
    const page = await api.request(signal, 'library.volumeChapters.list', volume.ref.id, {
      offset: offset(),
      limit: 50,
    })
    const rows = await Promise.all(
      page.items.map(async (item) => ({
        item,
        part: await api.request(signal, 'library.parts.get', item.chapter),
      })),
    )
    return { rows, total: page.total }
  })
  const choices = libraryRead(api, ['parts'], (signal) =>
    picking()
      ? api.request(
          signal,
          'library.parts.list',
          {
            work: { type: 'comic', id: volume.work.id },
            partType: 'comicChapter',
            search: search(),
          },
          { offset: pickOffset(), limit: 50 },
        )
      : null,
  )
  function title(row: PartDetails | null | undefined) {
    if (row?.data.name) {
      return row.data.name
    }
    if (row && 'numberLabel' in row.data && row.data.numberLabel) {
      return row.data.numberLabel
    }
    return t('library.parts.comicChapter')
  }
  async function move(item: VolumeChapter, i: number, by: number) {
    const pos = offset() + i + (by < 0 ? -1 : 2)
    const next = await api.call('library.volumeChapters.list', volume.ref.id, {
      offset: pos,
      limit: 1,
    })
    await api.call('library.volumeChapters.move', volume.ref.id, {
      ids: [item.chapter.id],
      before: next.items[0]?.chapter.id ?? null,
    })
  }
  async function add(chapter: PartRef) {
    await api.call('library.volumeChapters.applyChanges', volume.ref.id, {
      type: 'modify',
      add: [{ chapter: { type: 'comicChapter', id: chapter.id }, numberLabel: null }],
    })
    setPicking(false)
  }
  return (
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
          <DialogTitle>{t('library.volume.members')}</DialogTitle>
        </DialogHeader>
        <DialogBody class="space-y-3">
          <Show when={list.result()?.error ?? choices.result()?.error}>
            {(e) => <p role="alert">{errorMessage(e())}</p>}
          </Show>
          <Show
            when={!picking()}
            fallback={
              <>
                <SearchInput
                  aria-label={t('controls.search.label')}
                  clearLabel={t('controls.search.clear')}
                  value={search()}
                  onValueChange={(v) => {
                    setSearch(v)
                    setPickOffset(0)
                  }}
                />
                <For each={choices.result()?.value?.items}>
                  {(row) => (
                    <Button
                      class="block w-full text-start"
                      size="sm"
                      variant="ghost"
                      onClick={() => void add(row.ref).catch(reportError)}
                    >
                      {title(row)}
                    </Button>
                  )}
                </For>
                <Show when={(choices.result()?.value?.total ?? 0) > 50}>
                  <Button
                    size="sm"
                    disabled={!pickOffset()}
                    onClick={() => setPickOffset((v) => v - 50)}
                  >
                    {t('actions.previous')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pickOffset() + 50 >= (choices.result()?.value?.total ?? 0)}
                    onClick={() => setPickOffset((v) => v + 50)}
                  >
                    {t('actions.next')}
                  </Button>
                </Show>
              </>
            }
          >
            <For each={list.result()?.value?.rows}>
              {(row, i) => {
                const [label, setLabel] = createSignal(row.item.numberLabel ?? '')
                return (
                  <div class="space-y-2 border-b border-border py-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium">{title(row.part)}</span>
                      <div class="flex gap-1">
                        <For each={[-1, 1]}>
                          {(by) => (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={
                                offset() + i() + by < 0 ||
                                offset() + i() + by >= (list.result()?.value?.total ?? 0)
                              }
                              onClick={() => void move(row.item, i(), by).catch(reportError)}
                            >
                              {t(by < 0 ? 'actions.moveUp' : 'actions.moveDown')}
                            </Button>
                          )}
                        </For>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void api
                              .call('library.volumeChapters.applyChanges', volume.ref.id, {
                                type: 'modify',
                                remove: [row.item.chapter],
                              })
                              .catch(reportError)
                          }
                        >
                          {t('actions.remove')}
                        </Button>
                      </div>
                    </div>
                    <Field>
                      <FieldLabel>{t('library.volume.number')}</FieldLabel>
                      <div class="flex gap-2">
                        <Input class="grow" value={label()} onValueChange={setLabel} />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={(label() || null) === row.item.numberLabel}
                          onClick={() =>
                            void api
                              .call(
                                'library.volumeChapters.update',
                                volume.ref.id,
                                row.item.chapter.id,
                                label() || null,
                                row.item.numberLabel,
                              )
                              .catch(reportError)
                          }
                        >
                          {t('actions.save')}
                        </Button>
                      </div>
                    </Field>
                  </div>
                )
              }}
            </For>
            <Show when={(list.result()?.value?.total ?? 0) > 50}>
              <Button size="sm" disabled={!offset()} onClick={() => setOffset((v) => v - 50)}>
                {t('actions.previous')}
              </Button>
              <Button
                size="sm"
                disabled={offset() + 50 >= (list.result()?.value?.total ?? 0)}
                onClick={() => setOffset((v) => v + 50)}
              >
                {t('actions.next')}
              </Button>
            </Show>
          </Show>
        </DialogBody>
        <DialogFooter>
          <Button size="sm" variant="outline" class="me-auto" onClick={() => setPicking((v) => !v)}>
            {t(picking() ? 'actions.back' : 'library.volume.add')}
          </Button>
          <Button variant="ghost" onClick={props.close}>
            {t('actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
