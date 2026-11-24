import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { createQuery } from '../../../../infrastructure/query'
import { Check, Copy, Eye, Palette, Pencil, Plus, Trash2 } from '@lucide/solid'
import type { Theme, ThemeRef } from '@kisaki3/desktop-contracts/appearance'
import { Badge } from '@kisaki3/desktop-ui/badge'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { List, ListItem, ListItemAction } from '@kisaki3/desktop-ui/list'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import type { MainClient } from '../../../../infrastructure/api'
import type { EditorGuard } from '../../../../infrastructure/dialogs/closing'
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
  registerEditor: (guard: EditorGuard) => () => void
  confirmLeave: (guard: EditorGuard) => Promise<boolean>
}

export function Themes(props: ThemesProps) {
  const { api } = props
  const catalog = createQuery((signal) => api.request(signal, 'themes.list'))
  const preferences = createQuery((signal) => api.request(signal, 'preferences.get'))
  deferDialogUntil(
    () => (!!catalog.error || !!catalog.value) && (!!preferences.error || !!preferences.value),
  )
  const entries = createMemo(
    () =>
      new Map(
        (catalog.error ? [] : (catalog.value ?? [])).map((item) => [catalogKey(item.ref), item]),
      ),
  )
  const current = () => {
    const value = preferences.error ? undefined : preferences.value?.appearance.theme
    return value?.status === 'ready' ? value.value : undefined
  }
  const activeKey = () => {
    const ref = current()
    return ref ? catalogKey(ref) : undefined
  }

  const [preview, setPreview] = createSignal(props.target)
  const previewName = () => {
    const ref = preview()
    return ref ? entries().get(catalogKey(ref))?.name : undefined
  }
  const [edit, setEdit] = createSignal<ThemeEdit>()
  const [busy, setBusy] = createSignal(false)
  const confirm = createConfirmation(api.t)
  let alive = true
  let viewport!: HTMLElement
  let focusFrame: number | undefined

  const refresh = () => void catalog.reload()
  const reloadSelection = () => void preferences.reload()
  api.topics.addEventListener('themes.changed', refresh)
  api.topics.addEventListener('window.changed', reloadSelection)
  onCleanup(() => {
    alive = false
    if (focusFrame !== undefined) {
      cancelAnimationFrame(focusFrame)
    }
    api.topics.removeEventListener('themes.changed', refresh)
    api.topics.removeEventListener('window.changed', reloadSelection)
  })

  async function open(ref: ThemeRef, name: string) {
    const value = await api.call('themes.get', ref)
    if (!alive) {
      return
    }
    if (!value || !editable(value)) {
      throw new Error(api.t('runtime.unavailable'))
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
    if (!alive) {
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
    const copy = await api.call('themes.clone', ref, api.t('runtime.copySuffix', { name }))
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
        api.t('runtime.deleteThemeTitle'),
        api.t('actions.delete'),
        api.t('runtime.deleteTheme', { name }),
      )
    ) {
      await api.call('themes.delete', id)
    }
  }

  function saved(ref: ThemeRef) {
    setEdit(undefined)
    void reveal(ref).catch(reportError)
  }

  const failure = (): unknown => catalog.error ?? preferences.error
  function retry() {
    if (catalog.error) {
      refresh()
    }
    if (preferences.error) {
      reloadSelection()
    }
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('runtime.themes')}</DialogTitle>
      </DialogHeader>
      <DialogBody
        ref={(node) => {
          viewport = node
        }}
      >
        <QueryError
          error={failure()}
          retryLabel={api.t('runtime.retry')}
          retry={retry}
          class="mb-3"
        />
        <Show when={catalog.pending && !entries().size}>
          <Spinner label={api.t('runtime.loading')} />
        </Show>
        <List>
          <For each={[...entries().keys()]}>
            {(key) => {
              const item = () => entries().get(key)!
              const source = () => {
                const ref = item().ref
                const name = api.t(themeSource[ref.type])
                return ref.type === 'extension' ? name + ' · ' + ref.extensionId : name
              }

              return (
                <ListItem
                  icon={<Palette />}
                  title={
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{item().name}</span>
                      <Show when={activeKey() === key}>
                        <Badge tone="outline">{api.t('runtime.currentTheme')}</Badge>
                      </Show>
                    </div>
                  }
                  description={source()}
                  actions={
                    <>
                      <Show when={activeKey() !== key}>
                        <ListItemAction
                          label={api.t('runtime.use')}
                          aria-label={api.t('runtime.useThemeItem', { name: item().name })}
                          disabled={busy() || preferences.pending || !!preferences.error}
                          onClick={() => operate(() => useTheme(item().ref))}
                        >
                          <Check />
                        </ListItemAction>
                      </Show>
                      <ListItemAction
                        id={'theme-preview-' + key}
                        label={api.t('runtime.preview')}
                        aria-label={api.t('runtime.previewItem', { name: item().name })}
                        onClick={() => setPreview(item().ref)}
                      >
                        <Eye />
                      </ListItemAction>
                      <ListItemAction
                        label={api.t('runtime.duplicate')}
                        aria-label={api.t('runtime.duplicateItem', { name: item().name })}
                        disabled={busy()}
                        onClick={() => operate(() => duplicate(item().ref, item().name))}
                      >
                        <Copy />
                      </ListItemAction>
                      <Show when={item().ref.type === 'user' ? item().ref.id : undefined}>
                        {(id) => (
                          <>
                            <ListItemAction
                              label={api.t('actions.edit')}
                              aria-label={api.t('runtime.editItem', { name: item().name })}
                              disabled={busy()}
                              onClick={() => operate(() => open(item().ref, item().name))}
                            >
                              <Pencil />
                            </ListItemAction>
                            <ListItemAction
                              label={api.t('actions.delete')}
                              aria-label={api.t('runtime.deleteItem', { name: item().name })}
                              disabled={busy()}
                              destructive
                              onClick={() => operate(() => remove(id(), item().name))}
                            >
                              <Trash2 />
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
          onClick={() => operate(() => open(initialTheme, api.t('runtime.newTheme')))}
        >
          <Plus />
          {api.t('runtime.newTheme')}
        </Button>
      </DialogFooter>

      <ThemeInspection
        api={api}
        target={preview()}
        name={previewName()}
        close={() => setPreview(undefined)}
      />
      <EditorDialog
        edit={edit()}
        size="xl"
        registerEditor={props.registerEditor}
        confirmLeave={props.confirmLeave}
        onClose={() => setEdit(undefined)}
      >
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
