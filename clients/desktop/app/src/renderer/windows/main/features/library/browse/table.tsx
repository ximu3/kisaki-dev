import type { EntryQuery, EntryRef } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiCheck } from '@mdi/js'
import { createEffect, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { errorMessage } from '../../../../../infrastructure/notifications'
import type { createEntrySelection } from '../../../domain-ui/library/entries/selection'
import { libraryRead } from '../../../domain-ui/library/read'

export function EntryTable(props: {
  api: MainClient
  viewport: HTMLDivElement
  query: EntryQuery
  offset: number
  restore: { ref: EntryRef; top: number } | undefined
  selection: ReturnType<typeof createEntrySelection>
  paginate: (offset: number) => void
  open: (ref: EntryRef, top: number) => void
}) {
  const { api } = props,
    t = api.t
  const initialQuery = props.query
  let restore = props.restore
  const limit = 100,
    fields = ['rating', 'status', 'completionCount'] as const
  const result = libraryRead(api, ['entries'], async (signal) => {
    const query = props.query,
      offset = props.offset
    const anchor = query === initialQuery ? restore : undefined
    let start = offset
    if (anchor) {
      const found = await api.request(signal, 'library.entries.locate', query, anchor.ref, {
        limit: 1,
      })
      if (found) {
        start = Math.floor(found.index / limit) * limit
      }
    }
    const read = (at: number) =>
      api.request(signal, 'library.entries.list', query, { offset: at, limit, fields })
    let page = await read(start)
    if (start && start >= page.total) {
      start = Math.max(0, Math.floor((page.total - 1) / limit) * limit)
      page = await read(start)
    }
    return {
      ...page,
      offset: start,
      anchor:
        anchor &&
        page.items.some((item) => item.id === anchor.ref.id && item.type === anchor.ref.type)
          ? anchor
          : undefined,
    }
  })
  createEffect(
    () => result.result()?.value,
    (page) => {
      if (!page || !restore) {
        return
      }
      if (!page.anchor) {
        restore = undefined
        return
      }
      const { ref, top } = page.anchor
      const frame = requestAnimationFrame(() => {
        const row = props.viewport.querySelector<HTMLElement>(
          '[data-entry-id="' + CSS.escape(ref.id) + '"]',
        )
        if (!row) {
          return
        }
        props.viewport.scrollTop +=
          row.getBoundingClientRect().top - props.viewport.getBoundingClientRect().top - top
        restore = undefined
        props.selection.single({ ref })
        props.paginate(page.offset)
      })
      return () => cancelAnimationFrame(frame)
    },
  )
  return (
    <>
      <Show when={result.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
      <Show when={result.result()?.value}>
        {(page) => (
          <>
            <table class="w-full text-xs">
              <thead>
                <tr>
                  <th class="text-start">{t('library.fields.name')}</th>
                  <th>{t('library.fields.rating')}</th>
                  <th>{t('library.fields.status')}</th>
                  <th>{t('library.fields.additionalCount')}</th>
                </tr>
              </thead>
              <tbody>
                <For each={page().items}>
                  {(item) => (
                    <tr
                      data-entry-id={item.id}
                      data-entry-type={item.type}
                      class="border-t border-border"
                      onClick={(event) => {
                        const ref = { type: item.type, id: item.id }
                        if (props.selection.activate(event, { ref })) {
                          const top =
                            event.currentTarget.getBoundingClientRect().top -
                            props.viewport.getBoundingClientRect().top
                          props.open(ref, top)
                        }
                      }}
                    >
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-pressed={props.selection.items().has(item.id) ? 'true' : 'false'}
                        >
                          {item.name}
                          <Show when={props.selection.items().has(item.id)}>
                            <Icon path={mdiCheck} />
                          </Show>
                        </Button>
                      </td>
                      <td class="text-center">{item.rating == null ? '—' : item.rating / 10}</td>
                      <td class="text-center">
                        {'status' in item ? t(`library.status.${item.status ?? 'unset'}`) : '—'}
                      </td>
                      <td class="text-center">
                        {'completionCount' in item ? item.completionCount : '—'}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
            <Show when={page().total > 100}>
              <div class="flex justify-end gap-2">
                <Button
                  disabled={!page().offset}
                  variant="ghost"
                  onClick={() => props.paginate(page().offset - 100)}
                >
                  {t('actions.previous')}
                </Button>
                <Button
                  disabled={page().offset + 100 >= page().total}
                  variant="ghost"
                  onClick={() => props.paginate(page().offset + 100)}
                >
                  {t('actions.next')}
                </Button>
              </div>
            </Show>
          </>
        )}
      </Show>
    </>
  )
}
