import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import type { MainClient } from '../../../../infrastructure/api'
import { libraryRead } from './read'

export function LibraryReferencePicker(props: {
  api: MainClient
  kind: 'collection' | 'tag' | 'note'
  value: readonly string[]
  multiple?: boolean
  change: (ids: readonly string[]) => void
}) {
  const { api } = props,
    t = api.t,
    [search, setSearch] = createSignal(''),
    [offset, setOffset] = createSignal(0)
  const result = libraryRead(api, ['collections', 'tags', 'notes'], async (signal) => {
    const query = { search: search(), sort: { type: 'scope' as const } },
      range = { limit: 30, offset: offset() }
    if (props.kind === 'note') {
      const p = await api.request(
        signal,
        'library.notes.list',
        { search: search(), scope: { type: 'library' } },
        range,
      )
      return {
        items: p.items.map((n) => ({
          id: n.id,
          name: n.title ?? n.contentExcerpt ?? t('library.records.untitled'),
        })),
        total: p.total,
      }
    }
    return props.kind === 'tag'
      ? await api.request(signal, 'library.tags.list', query, range)
      : await api.request(
          signal,
          'library.collections.list',
          { ...query, ...(props.multiple && { membershipMode: 'manual' }) },
          range,
        )
  })
  return (
    <div class="space-y-2">
      <SearchInput
        aria-label={t('controls.search.label')}
        value={search()}
        clearLabel={t('controls.search.clear')}
        onValueChange={(v) => {
          setSearch(v)
          setOffset(0)
        }}
      />
      <div class="max-h-36 space-y-1 overflow-auto">
        <For each={result.result()?.value?.items}>
          {(item) => (
            <label class="flex items-center gap-2 text-sm">
              <Checkbox
                checked={props.value.includes(item.id)}
                onCheckedChange={(on) =>
                  props.change(
                    on
                      ? [...(props.multiple ? props.value : []), item.id]
                      : props.value.filter((id) => id !== item.id),
                  )
                }
              />
              {item.name}
            </label>
          )}
        </For>
      </div>
      <Show when={(result.result()?.value?.total ?? 0) > 30}>
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!offset()}
            onClick={() => setOffset((n) => n - 30)}
          >
            {t('actions.previous')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={offset() + 30 >= (result.result()?.value?.total ?? 0)}
            onClick={() => setOffset((n) => n + 30)}
          >
            {t('actions.next')}
          </Button>
        </div>
      </Show>
    </div>
  )
}
