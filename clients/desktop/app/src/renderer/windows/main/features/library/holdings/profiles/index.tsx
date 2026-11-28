import { createSignal, For, Show } from 'solid-js'
import { mdiPlus, mdiDotsHorizontal } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from '@kisaki3/desktop-ui/menu'
import type { WorkRef, FileWorkType } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { PresetButton, PresetPicker } from '../../../../domain-ui/library/presets'
import { libraryRead } from '../../../../domain-ui/library/read'
import { ProfileEditor, type ProfileEdit } from './editor'

export function ProfileManager(props: {
  api: MainClient
  work: WorkRef<FileWorkType>
  close: () => void
}) {
  const { api, work } = props,
    t = api.t,
    confirm = createConfirmation(t)
  const list = libraryRead(api, ['holdings'], (signal) =>
    api.request(signal, 'library.profiles.list', work.type),
  )
  const presets = libraryRead(api, ['holdings'], (signal) =>
    api.request(signal, 'library.profiles.presets', work.type),
  )
  const [pick, setPick] = createSignal(false),
    [edit, setEdit] = createSignal<ProfileEdit>()
  async function open(id: string, copy = false) {
    const row = await api.call('library.profiles.get', work.type, id)
    if (row) {
      setEdit(copy ? { copy: row } : { saved: row })
    }
  }
  async function remove(id: string, name: string) {
    const refs = await api.call('library.profiles.references', work.type, id)
    if (
      await confirm.ask(
        t('actions.deleteItem', { name }),
        t('actions.delete'),
        [name, ...refs.map((r) => r.path)].join('\n'),
      )
    ) {
      await api.call('library.profiles.delete', work.type, id)
    }
  }
  async function move(id: string, delta: number) {
    const before = (list.result()?.value ?? []).map((row) => row.id)
    const i = before.indexOf(id),
      next = [...before]
    if (i + delta < 0 || i + delta >= next.length) {
      return
    }
    ;[next[i], next[i + delta]] = [next[i + delta]!, next[i]!]
    const [first, ...rest] = next
    if (first) {
      await api.call('library.profiles.reorder', work.type, {
        order: [first, ...rest],
        expected: { order: before },
      })
    }
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
            <DialogTitle>{t('library.holdings.rules')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Show when={list.result()?.error}>
              {(e) => <p role="alert">{errorMessage(e())}</p>}
            </Show>
            <For
              each={list.result()?.value}
              keyed={(row) => row.id}
              fallback={
                <p class="p-4 text-center text-sm text-muted-foreground">{t('library.noMatch')}</p>
              }
            >
              {(row, index) => (
                <div class="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent">
                  <Button
                    variant="ghost"
                    class="min-w-0 grow justify-start"
                    onClick={() => void open(row().id).catch(reportError)}
                  >
                    {row().name}
                  </Button>
                  <Menu>
                    <MenuTrigger
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('actions.more') + ' · ' + row().name}
                    >
                      <Icon path={mdiDotsHorizontal} />
                    </MenuTrigger>
                    <MenuContent placement="bottom-end">
                      <MenuItem onSelect={() => void open(row().id).catch(reportError)}>
                        {t('actions.edit')}
                      </MenuItem>
                      <MenuItem onSelect={() => void open(row().id, true).catch(reportError)}>
                        {t('actions.duplicate')}
                      </MenuItem>
                      <MenuItem
                        disabled={index() === 0}
                        onSelect={() => void move(row().id, -1).catch(reportError)}
                      >
                        {t('actions.moveUp')}
                      </MenuItem>
                      <MenuItem
                        disabled={index() + 1 === (list.result()?.value?.length ?? 0)}
                        onSelect={() => void move(row().id, 1).catch(reportError)}
                      >
                        {t('actions.moveDown')}
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        onSelect={() => void remove(row().id, row().name).catch(reportError)}
                      >
                        {t('actions.delete')}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              )}
            </For>
          </DialogBody>
          <DialogFooter>
            <div class="me-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit({})}>
                <Icon path={mdiPlus} />
                {t('actions.create')}
              </Button>
              <PresetButton t={t} open={() => setPick(true)} />
            </div>
            <Button variant="ghost" onClick={props.close}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Show when={pick()}>
        <PresetPicker
          t={t}
          items={presets.result()?.value ?? []}
          multiple={false}
          close={() => setPick(false)}
          apply={(items) => {
            if (items[0]) {
              setEdit({ preset: items[0] })
            }
          }}
        />
      </Show>
      <EditorDialog edit={edit()} size="lg" onClose={() => setEdit(undefined)}>
        {(initial, controls) => (
          <ProfileEditor
            api={api}
            work={work}
            edit={initial}
            register={controls.registerEditor}
            close={controls.requestClose}
            saved={() => setEdit(undefined)}
            presets={presets.result()?.value ?? []}
          />
        )}
      </EditorDialog>
      <confirm.Content />
    </>
  )
}
