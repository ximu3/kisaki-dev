import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { mdiCheck } from '@mdi/js'
import type { EntryRef, EntryRule } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../infrastructure/api'
import { errorMessage } from '../../../../infrastructure/notifications'
import { catalogIcon } from './icons'
import { libraryRead } from './read'
import { browseQuery } from './query'

export function EntryPicker(props: {
  api: MainClient
  types: EntryRule['types']
  title: string
  multiple?: boolean
  initial?: readonly EntryRef[]
  choose: (refs: readonly EntryRef[]) => void
  close: () => void
}) {
  const { api } = props,
    t = api.t
  const [search, setSearch] = createSignal(''),
    [offset, setOffset] = createSignal(0)
  const [chosen, setChosen] = createSignal(
    new Map((props.initial ?? []).map((ref) => [ref.id, ref])),
  )
  const result = libraryRead(api, ['entries'], (signal) =>
    api.request(
      signal,
      'library.entries.list',
      { ...browseQuery({ type: 'library' }, props.types), search: search() },
      { offset: offset(), limit: 50 },
    ),
  )
  function pick(ref: EntryRef) {
    if (!props.multiple) {
      props.choose([ref])
      props.close()
      return
    }
    setChosen((rows) => {
      const next = new Map(rows)
      if (next.has(ref.id)) {
        next.delete(ref.id)
      } else {
        next.set(ref.id, ref)
      }
      return next
    })
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
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>
        <DialogBody class="space-y-2">
          <SearchInput
            autofocus
            value={search()}
            aria-label={t('controls.search.label')}
            clearLabel={t('controls.search.clear')}
            onValueChange={(v) => {
              setSearch(v)
              setOffset(0)
            }}
          />
          <Show when={result.result()?.error}>
            {(e) => <p role="alert">{errorMessage(e())}</p>}
          </Show>
          <Show when={result.result()?.value}>
            {(page) => (
              <>
                <div class="max-h-72 overflow-auto">
                  <For
                    each={page().items}
                    fallback={
                      <p class="py-4 text-center text-muted-foreground">{t('library.noMatch')}</p>
                    }
                  >
                    {(row) => (
                      <Button
                        class="w-full justify-start"
                        variant="ghost"
                        onClick={() => pick({ type: row.type, id: row.id })}
                      >
                        <Icon path={catalogIcon[row.type]} />
                        <span class="me-auto truncate">{row.name}</span>
                        <Show when={chosen().has(row.id)}>
                          <Icon path={mdiCheck} />
                        </Show>
                      </Button>
                    )}
                  </For>
                </div>
                <Show when={page().total > 50}>
                  <div class="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={offset() === 0}
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
        </DialogBody>
        <DialogFooter>
          <Show when={props.multiple}>
            <span class="me-auto text-xs">{t('library.selection', { count: chosen().size })}</span>
          </Show>
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Show when={props.multiple}>
            <Button
              onClick={() => {
                props.choose([...chosen().values()])
                props.close()
              }}
            >
              {t('actions.confirm')}
            </Button>
          </Show>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
