import type { ContentDirectory, FileWorkType, WorkRef } from '@kisaki3/desktop-contracts/library'
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
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { mdiDotsHorizontal, mdiFolderOpenOutline, mdiPlus } from '@mdi/js'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../read'
import { ProfileManager } from '../recognition'
import { DirectoryEditor } from './editor'
import { RelocateDirectory } from './relocate'

export function ManageDirectories(props: { api: MainClient; work: WorkRef }) {
  const [open, setOpen] = createSignal(false),
    { api } = props
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon path={mdiFolderOpenOutline} />
        {api.t('library.holdings.manage')}
      </Button>
      <Show when={open()}>
        <DirectoryManager api={api} work={props.work} close={() => setOpen(false)} />
      </Show>
    </>
  )
}

function DirectoryManager(props: { api: MainClient; work: WorkRef; close: () => void }) {
  const { api } = props,
    t = api.t,
    confirm = createConfirmation(t)
  const dirs = libraryRead(api, ['holdings'], (signal) =>
    api.request(signal, 'library.holdings.directories', props.work),
  )
  const [edit, setEdit] = createSignal<ContentDirectory<FileWorkType>>(),
    [relocate, setRelocate] = createSignal<ContentDirectory>(),
    [profiles, setProfiles] = createSignal<WorkRef<FileWorkType>>()
  const [error, setError] = createSignal<unknown>(),
    [busy, setBusy] = createSignal(false),
    [issues, setIssues] = createSignal<readonly string[]>([])
  async function add() {
    setError(undefined)
    setIssues([])
    setBusy(true)
    try {
      const path = await api.call('library.holdings.choosePath', 'directory')
      if (!path) {
        return
      }
      const result = await api.call('library.holdings.register', props.work, {
        type: 'directory',
        path,
      })
      setIssues(
        result.issues.map((issue) =>
          issue.code === 'initialRefreshFailed'
            ? issue.error.message
            : t('library.holdings.incompleteConfig'),
        ),
      )
    } catch (cause) {
      setError(() => cause)
    } finally {
      setBusy(false)
    }
  }
  async function remove(dir: ContentDirectory) {
    if (
      await confirm.ask(
        t('library.holdings.remove'),
        t('actions.remove'),
        dir.path + ' · ' + t('library.holdings.kept'),
      )
    ) {
      await api.call('library.holdings.removeDirectory', dir.work, dir.id)
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy()) {
            props.close()
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader closeLabel={t('actions.close')}>
            <DialogTitle>{t('library.holdings.manage')}</DialogTitle>
          </DialogHeader>
          <DialogBody class="space-y-1 py-3">
            <For
              each={dirs.result()?.value ?? []}
              keyed={(row) => row.id}
              fallback={
                <p class="p-4 text-center text-sm text-muted-foreground">{t('library.noMatch')}</p>
              }
            >
              {(dir) => (
                <DirectoryRow
                  api={api}
                  dir={dir()}
                  edit={setEdit}
                  relocate={setRelocate}
                  remove={remove}
                />
              )}
            </For>
            <For each={issues()}>{(issue) => <p role="status">{issue}</p>}</For>
            <Show when={error()}>{(cause) => <p role="alert">{errorMessage(cause())}</p>}</Show>
          </DialogBody>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              class="me-auto"
              disabled={busy()}
              onClick={() => void add()}
            >
              <Icon path={mdiPlus} />
              {t('library.holdings.add')}
            </Button>
            <Button variant="ghost" onClick={props.close}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EditorDialog edit={edit()} size="md" onClose={() => setEdit(undefined)}>
        {(dir, controls) => (
          <DirectoryEditor
            api={api}
            dir={dir}
            register={controls.registerEditor}
            close={controls.requestClose}
            saved={() => setEdit(undefined)}
            profiles={() => setProfiles(dir.work)}
          />
        )}
      </EditorDialog>
      <Show when={profiles()}>
        {(work) => <ProfileManager api={api} work={work()} close={() => setProfiles(undefined)} />}
      </Show>
      <Show when={relocate()}>
        {(dir) => <RelocateDirectory api={api} dir={dir()} close={() => setRelocate(undefined)} />}
      </Show>
      <confirm.Content />
    </>
  )
}

function DirectoryRow(props: {
  api: MainClient
  dir: ContentDirectory
  edit: (dir: ContentDirectory<FileWorkType>) => void
  relocate: (dir: ContentDirectory) => void
  remove: (dir: ContentDirectory) => Promise<void>
}) {
  const { api } = props,
    t = api.t
  return (
    <div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
      <Icon path={mdiFolderOpenOutline} class="size-4 shrink-0 text-muted-foreground" />
      <span class="min-w-0 grow truncate text-sm" title={props.dir.path}>
        {props.dir.path}
      </span>
      <Menu>
        <MenuTrigger
          size="icon-sm"
          variant="ghost"
          aria-label={t('actions.more') + ' · ' + props.dir.path}
        >
          <Icon path={mdiDotsHorizontal} />
        </MenuTrigger>
        <MenuContent placement="bottom-end">
          <MenuItem
            onSelect={() =>
              void api
                .call('library.holdings.openDirectory', props.dir.work, props.dir.id)
                .catch(reportError)
            }
          >
            {t('library.holdings.open')}
          </MenuItem>
          <Show when={'definition' in props.dir && props.dir}>
            {(item) => <MenuItem onSelect={() => props.edit(item())}>{t('actions.edit')}</MenuItem>}
          </Show>
          <MenuItem onSelect={() => props.relocate(props.dir)}>
            {t('library.holdings.relocate')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => void props.remove(props.dir).catch(reportError)}>
            {t('library.holdings.remove')}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}
