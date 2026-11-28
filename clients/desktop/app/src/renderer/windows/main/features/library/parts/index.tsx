import type { EntryLocation } from '../../../../../../shared/window-api/library'
import { createSignal, For, Show } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from '@kisaki3/desktop-ui/menu'
import { mdiPlus, mdiDotsHorizontal, mdiPlaylistPlay } from '@mdi/js'
import {
  partTypes,
  partWorkType,
  type WorkRef,
  type FileWorkType,
  type PartType,
  type PartQuery,
  type PartDetails,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../infrastructure/dialogs/confirmation'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import { errorMessage, reportError } from '../../../../../infrastructure/notifications'
import { libraryRead } from '../../../domain-ui/library/read'
import { VolumeChapters } from './volume'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { PartEditor, type PartEdit } from './editor'
import { FileManager } from '../holdings/files'

import { ManageDirectories } from '../holdings/directories'
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
export function WorkParts(props: {
  api: MainClient
  work: WorkRef<FileWorkType>
  location?: EntryLocation
}) {
  const [mode, setMode] = createSignal(props.location?.file ? 'files' : 'parts')
  const part = props.location?.parts.at(-1)
  const [edit, setEdit] = createSignal<PartEdit | undefined>(
    part && !props.location?.file
      ? { work: props.work, kind: part.ref.type, saved: part }
      : undefined,
  )
  return (
    <div class="space-y-6">
      <div class="flex justify-end">
        <ManageDirectories api={props.api} work={props.work} />
      </div>
      <Tabs value={mode()} onValueChange={setMode}>
        <TabList>
          <Tab value="parts">{props.api.t('library.queryFields.parts')}</Tab>
          <Tab value="files">{props.api.t('library.holdings.files')}</Tab>
        </TabList>
        <TabPanel value="parts" class="space-y-6 pt-4">
          {' '}
          <For each={partTypes.filter((kind) => partWorkType(kind) === props.work.type)}>
            {(kind) => <PartList api={props.api} work={props.work} kind={kind} edit={setEdit} />}
          </For>
        </TabPanel>
        <TabPanel value="files" class="pt-4">
          <FileManager
            api={props.api}
            work={props.work}
            {...(props.location?.file && { initial: props.location.file })}
          />
        </TabPanel>
      </Tabs>
      <EditorDialog edit={edit()} size="lg" onClose={() => setEdit(undefined)}>
        {(value, guard) => (
          <PartEditor
            api={props.api}
            edit={value}
            register={guard.registerEditor}
            close={guard.requestClose}
            saved={() => setEdit(undefined)}
          />
        )}
      </EditorDialog>
    </div>
  )
}
function PartList(props: {
  api: MainClient
  work: WorkRef<FileWorkType>
  kind: PartType
  edit: (v: PartEdit) => void
}) {
  const { api } = props,
    t = api.t,
    confirm = createConfirmation(t),
    [offset, setOffset] = createSignal(0),
    [merge, setMerge] = createSignal<PartDetails>()
  const [volume, setVolume] = createSignal<PartDetails>(),
    [related, setRelated] = createSignal<PartDetails>(),
    [search, setSearch] = createSignal(''),
    [status, setStatus] = createSignal<'allParts' | 'completed' | 'incomplete'>('allParts')
  async function move(row: PartDetails, i: number, by: number) {
    const at = offset() + i + (by < 0 ? -1 : 2),
      scope = { partType: props.kind, work: props.work } as PartQuery
    const next = await api.call(
      'library.parts.list',
      { ...scope, search: '' },
      { offset: at, limit: 1 },
    )
    await api.call('library.parts.move', scope, {
      ids: [row.ref.id],
      before: next.items[0]?.ref.id ?? null,
    })
  }
  const query = () =>
    ({
      work: props.work,
      partType: props.kind,
      search: search(),
      ...(status() !== 'allParts' && { completed: status() === 'completed' }),
    }) as PartQuery
  const read = libraryRead(api, ['parts'], (signal) =>
    api.request(signal, 'library.parts.list', query(), { offset: offset(), limit: 50 }),
  )
  const name = (row: PartDetails) =>
    row.data.name ||
    ('numberLabel' in row.data && row.data.numberLabel) ||
    t(`library.parts.${row.ref.type}`)
  async function remove(row: PartDetails) {
    if (
      await confirm.ask(
        t('actions.deleteItem', { name: name(row) }),
        t('actions.delete'),
        t('library.records.removePart'),
      )
    ) {
      await api.call('library.parts.delete', [row.ref])
    }
  }
  async function mergeInto(source: PartDetails, target: PartDetails) {
    if (
      await confirm.ask(
        t('library.records.mergePart'),
        t('actions.confirm'),
        name(source) + ' → ' + name(target),
      )
    ) {
      await api.call('library.parts.merge', { source: source.ref, target: target.ref })
      setMerge(undefined)
    }
  }
  return (
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">{t(`library.parts.${props.kind}`)}</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => props.edit({ work: props.work, kind: props.kind })}
        >
          <Icon path={mdiPlus} />
          {t('actions.create')}
        </Button>
      </div>
      <div class="flex gap-2">
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
        <Select
          value={status()}
          options={(['allParts', 'completed', 'incomplete'] as const).map((value) => ({
            value,
            label: t(`library.volume.${value}`),
          }))}
          emptyMessage={t('controls.search.empty')}
          invalidSelectionMessage={t('controls.feedback.unavailable')}
          onValueChange={(v) => {
            if (v) {
              setStatus(v)
              setOffset(0)
            }
          }}
        />
      </div>
      <Show when={merge()}>
        {(row) => (
          <div class="flex items-center justify-between text-sm">
            {t('library.records.mergePart')} · {name(row())}
            <Button variant="ghost" size="sm" onClick={() => setMerge(undefined)}>
              {t('actions.cancel')}
            </Button>
          </div>
        )}
      </Show>
      <Show when={read.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
      <Show when={read.result()?.value}>
        {(page) => (
          <>
            <Show
              when={page().items.length}
              fallback={
                <div class="grid justify-items-center gap-2 py-10 text-sm text-muted-foreground">
                  <Icon path={mdiPlaylistPlay} class="size-8" />
                  {t('library.detail.empty')}
                </div>
              }
            >
              <div class="divide-y overflow-hidden rounded-md border">
                <For each={page().items}>
                  {(row, i) => (
                    <div class="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={row.completed}
                        aria-label={name(row)}
                        onCheckedChange={(done) =>
                          void api
                            .call('library.parts.setCompletedMany', [row.ref], done)
                            .catch(reportError)
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        class="min-w-0 grow justify-start"
                        onClick={() => {
                          const source = merge()
                          if (source && source.ref.id !== row.ref.id) {
                            void mergeInto(source, row).catch(reportError)
                          } else if (!source) {
                            props.edit({ work: props.work, kind: props.kind, saved: row })
                          }
                        }}
                      >
                        {name(row)}
                      </Button>
                      <Menu>
                        <MenuTrigger
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t('actions.more') + ' · ' + name(row)}
                        >
                          <Icon path={mdiDotsHorizontal} />
                        </MenuTrigger>
                        <MenuContent placement="bottom-end">
                          <MenuItem
                            onSelect={() =>
                              props.edit({ work: props.work, kind: props.kind, saved: row })
                            }
                          >
                            {t('actions.edit')}
                          </MenuItem>
                          <Show when={props.kind === 'comicVolume'}>
                            <MenuItem onSelect={() => setVolume(row)}>
                              {t('library.volume.members')}
                            </MenuItem>
                          </Show>
                          <MenuItem onSelect={() => setRelated(row)}>
                            {t('library.holdings.files')}
                          </MenuItem>
                          <Show when={!search() && status() === 'allParts'}>
                            <For each={[-1, 1]}>
                              {(by) => (
                                <MenuItem
                                  disabled={
                                    offset() + i() + by < 0 || offset() + i() + by >= page().total
                                  }
                                  onSelect={() => void move(row, i(), by).catch(reportError)}
                                >
                                  {t(by < 0 ? 'actions.moveUp' : 'actions.moveDown')}
                                </MenuItem>
                              )}
                            </For>
                          </Show>
                          <MenuItem disabled={page().total < 2} onSelect={() => setMerge(row)}>
                            {t('library.records.mergePart')}
                          </MenuItem>
                          <Show
                            when={row.ref.type === 'animeEpisode' || row.ref.type === 'animeExtra'}
                          >
                            <MenuItem
                              onSelect={() =>
                                props.edit({
                                  work: props.work,
                                  kind:
                                    row.ref.type === 'animeEpisode' ? 'animeExtra' : 'animeEpisode',

                                  saved: row,
                                })
                              }
                            >
                              {t('library.records.changeKind')}
                            </MenuItem>
                          </Show>
                          <MenuSeparator />
                          <MenuItem onSelect={() => void remove(row).catch(reportError)}>
                            {t('actions.delete')}
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </div>
                  )}
                </For>
              </div>
            </Show>
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
      <Show when={volume()}>
        {(row) => <VolumeChapters api={api} volume={row()} close={() => setVolume(undefined)} />}
      </Show>
      <Show when={related()}>
        {(row) => (
          <Dialog
            open
            onOpenChange={(v) => {
              if (!v) {
                setRelated(undefined)
              }
            }}
          >
            <DialogContent size="lg">
              <DialogHeader closeLabel={t('actions.close')}>
                <DialogTitle>{name(row())}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <FileManager api={api} work={props.work} part={row().ref} />
              </DialogBody>
            </DialogContent>
          </Dialog>
        )}
      </Show>
      <confirm.Content />
    </section>
  )
}
