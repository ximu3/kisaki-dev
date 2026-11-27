import { createPreferencesQuery } from '../../domain-ui/preferences-query'
import { getOwner, isDisposed, createSignal, For, onSettled, Show } from 'solid-js'
import { createViewQuery } from '../../../../infrastructure/query'
import {
  mdiCheck,
  mdiContentCopy,
  mdiEyeOutline,
  mdiPaletteOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiDeleteOutline,
} from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import type { Theme, ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { Badge } from '@kisaki3/desktop-ui/badge'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { List, ListItem, ListItemAction } from '@kisaki3/desktop-ui/list'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import type { MainClient } from '../../../../infrastructure/api'
import {
  useDialogClose,
  type DialogPresentation,
} from '../../../../infrastructure/dialogs/presentation'
import { EditorDialog } from '../../../../infrastructure/dialogs/editor'
import { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { reportError } from '../../../../infrastructure/notifications'
import { catalogKey } from '../../../../../shared/catalog-ref'
import { themeSource } from '../../domain-ui/themes/selector'
import { ThemeEditor } from './editor'
import type { ThemeEdit } from './draft'
import { ThemeInspection } from './inspection'
import { QueryError } from '../../../../infrastructure/query/error'

const initialTheme = { type: 'builtin', id: 'default' } as const

interface ThemesProps {
  api: MainClient
  target?: ThemeRef | undefined
  view: DialogPresentation
}

export function Themes(props: ThemesProps) {
  const close = useDialogClose(props.view)
  const [visible, setVisible] = createSignal(false)

  return (
    <Dialog open={props.view.open()} onOpenChange={close.onOpenChange}>
      <DialogContent
        ref={close.ref}
        size="lg"
        onCloseRequest={close.onCloseRequest}
        onToggle={(event) => {
          const open = event.currentTarget.open
          setVisible(open)
          if (open && !props.target) {
            props.view.receipt?.presented()
          }
        }}
      >
        <ThemeCatalog {...props} visible={visible()} />
      </DialogContent>
    </Dialog>
  )
}

export async function checkThemeTarget(
  api: MainClient,
  ref: ThemeRef | undefined,
  signal: AbortSignal,
) {
  if (ref && !(await api.request(signal, 'themes.get', ref))) {
    throw new DesktopError('NotFound', api.t('controls.feedback.unavailable'))
  }
}

function ThemeCatalog(props: ThemesProps & { visible: boolean }) {
  const { api } = props
  const catalog = createViewQuery((signal) => api.request(signal, 'themes.list'))
  const preferences = createPreferencesQuery(api)
  deferDialogUntil(() => !!catalog.result() && !!preferences.result())
  const entries = () => catalog.result()?.value
  const current = () => {
    const value = preferences.result()?.value?.appearance.theme
    return value?.status === 'ready' ? value.value : undefined
  }
  const activeKey = () => {
    const ref = current()
    return ref ? catalogKey(ref) : undefined
  }

  const [preview, setPreview] = createSignal(props.target)
  const previewName = () => {
    const ref = preview()
    return ref
      ? entries()?.find((item) => catalogKey(item.ref) === catalogKey(ref))?.name
      : undefined
  }
  const [edit, setEdit] = createSignal<ThemeEdit>()
  const [busy, setBusy] = createSignal(false)
  const confirm = createConfirmation(api.t)
  const owner = getOwner()!
  let viewport!: HTMLElement
  let focusFrame: number | undefined

  const refresh = () => void catalog.reload()
  onSettled(() => {
    api.topics.addEventListener('themes.changed', refresh)
    return () => {
      if (focusFrame !== undefined) {
        cancelAnimationFrame(focusFrame)
      }
      api.topics.removeEventListener('themes.changed', refresh)
    }
  })

  async function open(ref: ThemeRef, name: string) {
    const value = await api.call('themes.get', ref)
    if (isDisposed(owner)) {
      return
    }
    if (!value || !editable(value)) {
      throw new Error(api.t('controls.feedback.unavailable'))
    }
    setEdit({
      id: ref.type === 'user' ? ref.id : null,
      definition: { name, light: value.light, dark: value.dark },
    })
  }

  function operate(action: () => Promise<unknown>) {
    setBusy(true)
    void action()
      .catch(reportError)
      .finally(() => setBusy(false))
  }

  async function reveal(ref: ThemeRef) {
    await catalog.reload()
    if (isDisposed(owner)) {
      return
    }

    if (focusFrame !== undefined) {
      cancelAnimationFrame(focusFrame)
    }
    focusFrame = requestAnimationFrame(() => {
      focusFrame = undefined
      viewport
        .querySelector<HTMLElement>(`#${CSS.escape('theme-preview-' + catalogKey(ref))}`)
        ?.focus()
    })
  }
  async function duplicate(ref: ThemeRef, name: string) {
    const copy = await api.call('themes.clone', ref, api.t('themes.copyName', { name }))
    await reveal(copy)
  }

  async function useTheme(ref: ThemeRef) {
    const old = current()
    const next = await api.call('preferences.update', {
      changes: { appearance: { theme: ref } },
      ...(old && { expected: { appearance: { theme: old } } }),
    })
    preferences.accept(next)
  }

  async function remove(id: string, name: string) {
    if (
      await confirm.ask(
        api.t('themes.delete'),
        api.t('actions.delete'),
        api.t('themes.confirmDelete', { name }),
      )
    ) {
      await api.call('themes.delete', id)
    }
  }

  function saved(ref: ThemeRef) {
    setEdit(undefined)
    void reveal(ref).catch(reportError)
  }

  const failure = (): unknown => catalog.result()?.error ?? preferences.result()?.error
  function retry() {
    if (catalog.result()?.error) {
      refresh()
    }
    if (preferences.result()?.error) {
      preferences.reload()
    }
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('themes.title')}</DialogTitle>
      </DialogHeader>
      <DialogBody
        ref={(node) => {
          viewport = node
        }}
      >
        <QueryError
          error={failure()}
          retryLabel={api.t('actions.retry')}
          retry={retry}
          class="mb-3"
        />
        <Show when={catalog.pending() && !entries()?.length}>
          <Spinner label={api.t('controls.feedback.loading')} />
        </Show>
        <List>
          <For each={entries()} keyed={(item) => catalogKey(item.ref)}>
            {(item) => {
              const key = () => catalogKey(item().ref)
              const source = () => {
                const ref = item().ref
                const name = api.t(themeSource[ref.type])
                return ref.type === 'extension' ? name + ' · ' + ref.extensionId : name
              }

              return (
                <ListItem
                  icon={<Icon path={mdiPaletteOutline} />}
                  title={
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{item().name}</span>
                      <Show when={activeKey() === key()}>
                        <Badge tone="outline">{api.t('themes.current')}</Badge>
                      </Show>
                    </div>
                  }
                  description={source()}
                  actions={
                    <>
                      <Show when={activeKey() !== key()}>
                        <ListItemAction
                          label={api.t('actions.use')}
                          aria-label={api.t('themes.useNamed', { name: item().name })}
                          disabled={
                            busy() || preferences.pending() || !!preferences.result()?.error
                          }
                          onClick={() => operate(() => useTheme(item().ref))}
                        >
                          <Icon path={mdiCheck} />
                        </ListItemAction>
                      </Show>
                      <ListItemAction
                        id={'theme-preview-' + key()}
                        label={api.t('actions.preview')}
                        aria-label={api.t('actions.previewItem', { name: item().name })}
                        onClick={() => setPreview(item().ref)}
                      >
                        <Icon path={mdiEyeOutline} />
                      </ListItemAction>
                      <ListItemAction
                        label={api.t('actions.duplicate')}
                        aria-label={api.t('actions.duplicateItem', { name: item().name })}
                        disabled={busy()}
                        onClick={() => operate(() => duplicate(item().ref, item().name))}
                      >
                        <Icon path={mdiContentCopy} />
                      </ListItemAction>
                      <Show when={item().ref.type === 'user' ? item().ref.id : undefined}>
                        {(id) => (
                          <>
                            <ListItemAction
                              label={api.t('actions.edit')}
                              aria-label={api.t('actions.editItem', { name: item().name })}
                              disabled={busy()}
                              onClick={() => operate(() => open(item().ref, item().name))}
                            >
                              <Icon path={mdiPencilOutline} />
                            </ListItemAction>
                            <ListItemAction
                              label={api.t('actions.delete')}
                              aria-label={api.t('actions.deleteItem', { name: item().name })}
                              disabled={busy()}
                              destructive
                              onClick={() => operate(() => remove(id(), item().name))}
                            >
                              <Icon path={mdiDeleteOutline} />
                            </ListItemAction>
                          </>
                        )}
                      </Show>
                    </>
                  }
                />
              )
            }}
          </For>
        </List>
      </DialogBody>
      <DialogFooter class="justify-start">
        <Button
          variant="outline"
          disabled={busy()}
          onClick={() => operate(() => open(initialTheme, api.t('themes.create')))}
        >
          <Icon path={mdiPlus} />
          {api.t('themes.create')}
        </Button>
      </DialogFooter>

      <ThemeInspection
        api={api}
        target={props.visible ? preview() : undefined}
        receipt={props.target ? props.view.receipt : undefined}
        name={previewName()}
        close={() => setPreview(undefined)}
      />
      <EditorDialog edit={edit()} size="xl" onClose={() => setEdit(undefined)}>
        {(value, controls) => (
          <ThemeEditor
            api={api}
            initial={value}
            registerEditor={controls.registerEditor}
            requestClose={controls.requestClose}
            onSaved={saved}
          />
        )}
      </EditorDialog>
      <confirm.Content />
    </>
  )
}

function editable(theme: Theme): theme is Theme<'user' | 'builtin'> {
  return theme.ref.type !== 'extension'
}
