import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { FileRow } from './row'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { mdiDotsHorizontal, mdiFolderSyncOutline, mdiPlus } from '@mdi/js'
import type {
  FileWorkType,
  WorkRef,
  HeldFile,
  PartRef,
  FileRecognitionResult,
  PreferredPartFile,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../../../domain-ui/library/read'
import { SavedSettings } from '../settings'
import { TracksEditor } from '../settings/tracks'
import type { UsagePreferenceTarget } from '@kisaki3/desktop-contracts/library'
import { ProfileManager } from '../profiles'
import { FileDetails, FileAssociations } from './details'
import { FilterFiles, type FileFilters } from './filters'
export function FileManager(props: {
  api: MainClient
  work: WorkRef<FileWorkType>
  part?: PartRef
  initial?: HeldFile
}) {
  const { api, work } = props,
    t = api.t,
    confirm = createConfirmation(t)
  const [term, setTerm] = createSignal(''),
    [offset, setOffset] = createSignal(0),
    [selected, setSelected] = createSignal<readonly HeldFile[]>([])
  const [filters, setFilters] = createSignal<FileFilters>({})
  const data = libraryRead(api, ['holdings'], (signal) =>
    api.request(
      signal,
      'library.files.list',
      work,
      { search: term(), ...filters(), ...(props.part && { part: props.part }) },
      { offset: offset(), limit: 50 },
    ),
  )
  const [settings, setSettings] = createSignal<UsagePreferenceTarget>(),
    [tracks, setTracks] = createSignal<HeldFile<'anime'>>()
  const [profile, setProfile] = createSignal(false),
    [edit, setEdit] = createSignal<{ type: 'details' | 'parts'; file: HeldFile } | undefined>(
      props.initial ? { type: 'details', file: props.initial } : undefined,
    ),
    [merge, setMerge] = createSignal<{ source: HeldFile; target: HeldFile }>()
  const [report, setReport] = createSignal<readonly string[]>(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal<unknown>()
  async function run(task: () => Promise<readonly string[]>) {
    setBusy(true)
    setError(undefined)
    setReport(undefined)
    try {
      setReport(await task())
    } catch (cause) {
      setError(() => cause)
    } finally {
      setBusy(false)
    }
  }
  function explain(r: FileRecognitionResult) {
    if (r.outcome === 'unmatched') {
      return t('library.holdings.unmatched')
    }
    const s = r.source
    let source = ''
    if (s?.type === 'builtin') {
      source = t('library.holdings.builtin')
    } else if (s) {
      source =
        t(s.type === 'draft' ? 'library.holdings.draft' : 'library.holdings.profile') +
        ' · ' +
        s.ruleId
    }
    return [
      source,
      r.outcome === 'failed'
        ? r.error.message
        : t('library.holdings.matched') + ' · ' + r.parts.map((part) => part.id).join(', '),
    ]
      .filter(Boolean)
      .join(' · ')
  }
  async function add(kind: 'file' | 'directory') {
    const path = await api.call('library.holdings.choosePath', kind)
    if (!path) {
      return []
    }
    const id = await api.call('library.files.add', work, {
      path,
      ...(props.part && { associations: [{ part: props.part }] }),
    })
    const result = await api.call('library.files.get', work, id)
    return [result?.path ?? path]
  }
  async function refresh() {
    const r = await api.call('library.holdings.refresh', work)
    return [
      t('library.holdings.found') + ' · ' + r.discovery.registeredFileIds.length,
      ...r.discovery.issues.map((i) => i.path + ' · ' + i.error.message),
      ...r.files.map(
        (item) =>
          item.fileId +
          ' · ' +
          (item.recognition ? explain(item.recognition) : item.availability.status),
      ),
    ]
  }
  async function relocate(row: HeldFile) {
    const path = await api.call('library.holdings.choosePath', row.kind)
    if (!path) {
      return []
    }
    const r = await api.call('library.files.relocate', work, row.id, path, row.path)
    return [
      ...r.updated.map((item) => item.from + ' → ' + item.to),
      ...r.issues.map((i) => i.path + ' · ' + i.error.message),
    ]
  }
  async function remove(rows: readonly HeldFile[]) {
    if (
      await confirm.ask(
        t('library.holdings.remove'),
        t('actions.remove'),
        rows.map((r) => r.path).join('\n'),
      )
    ) {
      await api.call(
        'library.files.remove',
        work,
        rows.map((row) => row.id),
      )
      setSelected([])
    }
  }
  async function preferSelected() {
    const files = selected(),
      byPart = new Map<string, string>(),
      values: PreferredPartFile[] = []
    for (const file of files) {
      if (!file.associations.length) {
        throw new Error(t('library.fileFilter.unlinked', { file: file.path }))
      }
      for (const { part } of file.associations) {
        const previous = byPart.get(part.id)
        if (previous) {
          throw new Error(t('library.fileFilter.overlap', { first: previous, second: file.path }))
        }
        byPart.set(part.id, file.path)
        values.push({ part, fileId: file.id })
      }
    }
    await api.call('library.files.setPreferredMany', work, values)
    return files.map((file) => file.path)
  }
  async function recognize() {
    const r = await api.call(
      'library.files.reidentify',
      work,
      selected().map((row) => row.id),
    )
    return r.files.map(
      (row) =>
        (selected().find((file) => file.id === row.fileId)?.path ?? row.fileId) +
        ' · ' +
        explain(row.result),
    )
  }
  async function combine(path: string) {
    const choice = merge()!
    const r = await api.call('library.files.merge', work, {
      sourceFileId: choice.source.id,
      targetFileId: choice.target.id,
      path,
    })
    setMerge(undefined)
    setSelected([])
    return [r.path]
  }
  return (
    <section class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="me-auto text-sm font-semibold">{t('library.holdings.files')}</h3>
        <Button size="sm" variant="outline" disabled={busy()} onClick={() => void run(refresh)}>
          <Icon path={mdiFolderSyncOutline} />
          {t('actions.refresh')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy()}
          onClick={() => void run(() => add('file'))}
        >
          <Icon path={mdiPlus} />
          {t('library.holdings.registerFile')}
        </Button>
        <Menu>
          <MenuTrigger
            size="icon-sm"
            variant="outline"
            aria-label={t('library.holdings.files') + ' · ' + t('actions.more')}
          >
            <Icon path={mdiDotsHorizontal} />
          </MenuTrigger>
          <MenuContent placement="bottom-end">
            <Show when={work.type !== 'anime'}>
              <MenuItem onSelect={() => void run(() => add('directory'))}>
                {t('library.holdings.addPages')}
              </MenuItem>
            </Show>
            <MenuItem onSelect={() => setSettings({ type: 'work' })}>
              {t('library.localSettings.fromWork')}
            </MenuItem>
            <MenuItem onSelect={() => setProfile(true)}>{t('library.holdings.rules')}</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div class="flex items-center gap-2">
        <FilterFiles
          api={api}
          work={work}
          value={filters()}
          change={(v) => {
            setFilters(v)
            setOffset(0)
            setSelected([])
          }}
        />
        <SearchInput
          class="min-w-0 grow"
          aria-label={t('library.holdings.files')}
          clearLabel={t('controls.search.clear')}
          value={term()}
          onValueChange={(v) => {
            setTerm(v)
            setOffset(0)
            setSelected([])
          }}
        />
      </div>
      <Show when={selected().length}>
        <div class="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy()}
            onClick={() => void run(preferSelected)}
          >
            {t(`library.fileFilter.assign`)}
          </Button>
          <Button size="sm" variant="outline" disabled={busy()} onClick={() => void run(recognize)}>
            {t('library.holdings.reidentify')}
          </Button>
          <Show when={selected().length === 2}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMerge({ source: selected()[0]!, target: selected()[1]! })}
            >
              {t('library.holdings.merge')}
            </Button>
          </Show>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void remove(selected()).catch(reportError)}
          >
            {t('library.holdings.remove')}
          </Button>
        </div>
      </Show>
      <Show when={data.result()?.error ?? error()}>
        {(e) => <p role="alert">{errorMessage(e())}</p>}
      </Show>
      <Show when={report()?.length}>
        <div role="status" class="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
          <For each={report()}>{(line) => <p class="break-all text-xs">{line}</p>}</For>
        </div>
      </Show>
      <Show when={data.result()?.value}>
        {(page) => (
          <>
            <div class="divide-y overflow-hidden rounded-md border">
              <For
                each={page().items}
                keyed={(row) => row.id}
                fallback={
                  <p class="p-4 text-center text-sm text-muted-foreground">
                    {t('library.detail.empty')}
                  </p>
                }
              >
                {(file) => (
                  <FileRow
                    api={api}
                    file={file()}
                    part={props.part}
                    selected={selected().some((v) => v.id === file().id)}
                    toggle={(on) =>
                      setSelected((rows) =>
                        on ? [...rows, file()] : rows.filter((r) => r.id !== file().id),
                      )
                    }
                    edit={(type) => setEdit({ type, file: file() })}
                    settings={() => setSettings({ type: 'file', fileId: file().id })}
                    tracks={setTracks}
                    test={() =>
                      void run(async () => [
                        explain(
                          await api.call('library.files.testRecognition', work, file().id, {}),
                        ),
                      ])
                    }
                    relocate={() => void run(() => relocate(file()))}
                    remove={() => void remove([file()]).catch(reportError)}
                  />
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
      <EditorDialog edit={edit()} size="md" onClose={() => setEdit(undefined)}>
        {(v, controls) => {
          const args = {
            api,
            file: v.file,
            register: controls.registerEditor,
            close: controls.requestClose,
            saved: () => setEdit(undefined),
          }
          return v.type === 'details' ? <FileDetails {...args} /> : <FileAssociations {...args} />
        }}
      </EditorDialog>
      <Show when={merge()}>
        {(choice) => (
          <Dialog
            open
            onOpenChange={(v) => {
              if (!v) {
                setMerge(undefined)
              }
            }}
          >
            <DialogContent size="md">
              <DialogHeader closeLabel={t('actions.close')}>
                <DialogTitle>{t('library.holdings.merge')}</DialogTitle>
              </DialogHeader>
              <DialogBody class="space-y-2">
                <p class="break-all text-sm">
                  {choice().source.path} → {choice().target.path}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMerge({ source: choice().target, target: choice().source })}
                >
                  {t('library.records.reverse')}
                </Button>
              </DialogBody>
              <DialogFooter>
                <For each={[choice().source.path, choice().target.path]}>
                  {(path) => (
                    <Button
                      variant="outline"
                      title={path}
                      disabled={busy()}
                      onClick={() => void run(() => combine(path))}
                    >
                      {t('actions.use')} · {path}
                    </Button>
                  )}
                </For>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </Show>
      <Show when={settings()}>
        {(target) => (
          <SavedSettings
            api={api}
            work={work}
            target={target()}
            close={() => setSettings(undefined)}
          />
        )}
      </Show>
      <EditorDialog edit={tracks()} size="md" onClose={() => setTracks(undefined)}>
        {(file, g) => (
          <TracksEditor
            api={api}
            file={file}
            register={g.registerEditor}
            close={g.requestClose}
            saved={() => setTracks(undefined)}
          />
        )}
      </EditorDialog>
      <Show when={profile()}>
        <ProfileManager api={api} work={work} close={() => setProfile(false)} />
      </Show>
      <confirm.Content />
    </section>
  )
}
