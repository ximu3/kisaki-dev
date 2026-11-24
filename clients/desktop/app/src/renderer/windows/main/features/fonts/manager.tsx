import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { createQuery } from '../../../../infrastructure/query'
import { CaseSensitive, Eye, Pencil, Plus, Trash2 } from '@lucide/solid'
import type { Font } from '@kisaki3/desktop-contracts/fonts'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { List, ListItem, ListItemAction } from '@kisaki3/desktop-ui/list'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import type { MainClient } from '../../../../infrastructure/api'
import type { EditorGuard } from '../../../../infrastructure/dialogs/closing'
import { EditorDialog } from '../../../../infrastructure/dialogs/editor'
import { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { reportError } from '../../../../infrastructure/notifications'
import { FontEditor } from './editor'
import { FontDetails, type FontSelection } from './details'
import { QueryError } from '../../../../infrastructure/query/error'

const pageSize = 50

interface FontsProps {
  api: MainClient
  target?: string | undefined
  registerEditor: (guard: EditorGuard) => () => void
  confirmLeave: (guard: EditorGuard) => Promise<boolean>
}

export function Fonts(props: FontsProps) {
  const { api } = props
  const [offset, setOffset] = createSignal(0)
  const list = createQuery({
    prepare() {
      const from = offset()

      return async (signal) => {
        const result = await api.request(signal, 'fonts.list', '', {
          offset: from,
          limit: pageSize,
        })
        return { from, result }
      }
    },
  })
  const page = () => {
    const response = list.error ? undefined : list.value
    return response?.from === offset() ? response.result : undefined
  }
  deferDialogUntil(() => !!list.error || !!page())
  const entries = createMemo(() => new Map(page()?.items.map((item) => [item.id, item])))
  const count = () => page()?.total ?? 0
  let viewport!: HTMLElement

  const [preview, setPreview] = createSignal<FontSelection | undefined>(
    props.target ? { id: props.target } : undefined,
  )
  const [edit, setEdit] = createSignal<{ font: Font | null; files: readonly File[] }>()
  const confirm = createConfirmation(api.t)
  let editRequest = 0
  let focusFrame: number | undefined

  const refresh = () => void list.reload()
  api.topics.addEventListener('fonts.changed', refresh)
  onCleanup(() => {
    editRequest++
    if (focusFrame !== undefined) {
      cancelAnimationFrame(focusFrame)
    }
    api.topics.removeEventListener('fonts.changed', refresh)
  })

  function changePage(next: number) {
    setOffset(next)
    viewport.scrollTop = 0
  }

  createEffect(
    () => [page(), offset()],
    ([result, start]) => {
      if (result && start > 0 && start >= result.total) {
        changePage(Math.max(0, Math.floor((result.total - 1) / pageSize) * pageSize))
      }
    },
  )

  function start(files: readonly File[] = []) {
    editRequest++
    setEdit({ font: null, files })
  }
  async function open(id: string) {
    const version = ++editRequest
    const font = await api.call('fonts.get', id)
    if (version !== editRequest) {
      return
    }
    if (!font) {
      throw new Error(api.t('runtime.unavailable'))
    }
    setEdit({ font, files: [] })
  }

  async function remove(id: string, name: string) {
    if (
      await confirm.ask(
        api.t('runtime.deleteFontTitle'),
        api.t('actions.delete'),
        api.t('runtime.deleteFont', { name }),
      )
    ) {
      await api.call('fonts.delete', id)
    }
  }

  async function saved(font: Font) {
    const version = ++editRequest
    setEdit(undefined)
    await Promise.resolve()
    const previous = document.activeElement
    await list.reload()
    if (version !== editRequest) {
      return
    }

    if (focusFrame !== undefined) {
      cancelAnimationFrame(focusFrame)
    }
    focusFrame = requestAnimationFrame(() => {
      focusFrame = undefined
      if (version !== editRequest) {
        return
      }
      if (document.activeElement === previous || document.activeElement === document.body) {
        viewport.querySelector<HTMLElement>(`#${CSS.escape('font-preview-' + font.id)}`)?.focus()
      }
    })
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('runtime.fonts')}</DialogTitle>
      </DialogHeader>
      <DialogBody
        ref={(node) => {
          viewport = node
        }}
        onDragOver={(event) => {
          if (event.dataTransfer?.types.includes('Files')) {
            event.preventDefault()
          }
        }}
        onDrop={(event) => {
          if (event.dataTransfer?.files.length) {
            event.preventDefault()
            start(Array.from(event.dataTransfer.files))
          }
        }}
        onPaste={(event) => {
          if (event.clipboardData?.files.length) {
            event.preventDefault()
            start(Array.from(event.clipboardData.files))
          }
        }}
      >
        <QueryError error={list.error} retryLabel={api.t('runtime.retry')} retry={refresh} />
        <Show
          when={page()}
          fallback={!list.error && <Spinner label={api.t('runtime.loadingFonts')} />}
        >
          <Show
            when={entries().size}
            fallback={<EmptyState heading={api.t('runtime.emptyFonts')} />}
          >
            <List>
              <For each={[...entries().keys()]}>
                {(id) => {
                  const name = () => entries().get(id)!.name
                  return (
                    <ListItem
                      icon={<CaseSensitive />}
                      title={name()}
                      actions={
                        <>
                          <ListItemAction
                            id={'font-preview-' + id}
                            label={api.t('runtime.preview')}
                            aria-label={api.t('runtime.previewItem', { name: name() })}
                            onClick={() => setPreview({ id, name: name() })}
                          >
                            <Eye />
                          </ListItemAction>
                          <ListItemAction
                            label={api.t('actions.edit')}
                            aria-label={api.t('runtime.editItem', { name: name() })}
                            onClick={() => void open(id).catch(reportError)}
                          >
                            <Pencil />
                          </ListItemAction>
                          <ListItemAction
                            label={api.t('actions.delete')}
                            aria-label={api.t('runtime.deleteItem', { name: name() })}
                            destructive
                            onClick={() => void remove(id, name()).catch(reportError)}
                          >
                            <Trash2 />
                          </ListItemAction>
                        </>
                      }
                    />
                  )
                }}
              </For>
            </List>
          </Show>
        </Show>
      </DialogBody>
      <DialogFooter class="justify-between">
        <Button variant="outline" onClick={() => start()}>
          <Plus />
          {api.t('runtime.newFont')}
        </Button>
        <Show when={count() > pageSize || offset() > 0}>
          <ToolbarRow>
            <Button
              variant="outline"
              disabled={!offset()}
              onClick={() => changePage(offset() - pageSize)}
            >
              {api.t('runtime.previous')}
            </Button>
            <Button
              variant="outline"
              disabled={offset() + pageSize >= count()}
              onClick={() => changePage(offset() + pageSize)}
            >
              {api.t('runtime.next')}
            </Button>
          </ToolbarRow>
        </Show>
      </DialogFooter>

      <FontDetails api={api} selected={preview()} close={() => setPreview(undefined)} />
      <EditorDialog
        edit={edit()}
        size="lg"
        registerEditor={props.registerEditor}
        confirmLeave={props.confirmLeave}
        onClose={() => setEdit(undefined)}
      >
        {(value, controls) => (
          <FontEditor
            api={api}
            initial={value.font}
            files={value.files}
            registerEditor={controls.registerEditor}
            requestClose={controls.requestClose}
            onSaved={(font) => void saved(font).catch(reportError)}
          />
        )}
      </EditorDialog>
      <confirm.Content />
    </>
  )
}
