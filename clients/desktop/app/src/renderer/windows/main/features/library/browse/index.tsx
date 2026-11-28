import { createMemo, createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Menu, MenuContent, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { Popover, PopoverTrigger, PopoverContent } from '@kisaki3/desktop-ui/popover'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import {
  mdiCheck,
  mdiDotsHorizontal,
  mdiViewGridOutline,
  mdiTable,
  mdiBookshelf,
  mdiFolderOutline,
  mdiHeartOutline,
  mdiTagOutline,
} from '@mdi/js'
import {
  entryTypes,
  type EntryQuery,
  type EntrySort,
  type EntryRule,
  type EntryRef,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { readCards, locateCard, CardShelf, type CardItem } from '../../../domain-ui/library/cards'
import { TypeRange } from '../../../domain-ui/library/types'
import { PageBar } from '../../../domain-ui/library/chrome'
import { libraryRead } from '../../../domain-ui/library/read'

import { FilterDialog } from '../../../domain-ui/library/filters'
import { QuerySort } from '../../../domain-ui/library/filters/sort'
import { createEntrySelection } from '../../../domain-ui/library/selection'
import { createEntryActions } from '../../../domain-ui/library/entry-actions'
import type { LibraryVisit } from '../navigation'

export function BrowseEntries(props: {
  api: MainClient
  visit?: LibraryVisit | undefined
  query: EntryQuery
  title: string
  open: (ref: EntryRef) => void
}) {
  const { api } = props,
    t = api.t
  const initial = props.visit?.browse?.query ?? props.query,
    previous = props.visit?.card
  const [rules, setRules] = createSignal(initial.rules),
    [sort, setSort] = createSignal<EntrySort>(initial.sort),
    [filter, setFilter] = createSignal(false)
  const [search, setSearch] = createSignal(initial.search)
  const [grid, setGrid] = createSignal(props.visit?.browse?.grid ?? true)
  const [offset, setOffset] = createSignal(props.visit?.browse?.offset ?? 0)
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
  const query = createMemo((): EntryQuery => ({
    ...props.query,
    rules: rules(),
    search: search(),
    sort: sort(),
  }))
  const selection = createEntrySelection(api, query)
  const actions = createEntryActions(
    api,
    () => [...selection.items().values()],
    (ref) => {
      selection.clear()
      if (ref) {
        props.open(ref)
      }
    },
  )
  function target(event: Event) {
    const row =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-entry-id]') : null
    const type = entryTypes.find((kind) => kind === row?.dataset.entryType)
    const id = row?.dataset.entryId
    return type && id ? { type, id } : undefined
  }
  function prepare(event: MouseEvent | KeyboardEvent) {
    const ref = target(event)
    if (ref) {
      actions.capture(selection.context({ ref }))
    } else {
      event.preventDefault()
    }
  }
  function keys(event: KeyboardEvent) {
    const ref = target(event)
    if (!ref) {
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      selection.toggle({ ref })
    } else {
      selection.keys(event)
    }
  }
  const cardQuery = () => ({ kind: 'entry' as const, ...query(), referenceLabels: [] })
  const table = libraryRead(api, ['entries'], (signal) =>
    grid()
      ? null
      : api.request(signal, 'library.entries.list', query(), {
          offset: offset(),
          limit: 100,
          fields: ['rating', 'status', 'completionCount'],
        }),
  )
  const icon = () => {
    switch (props.query.scope.type) {
      case 'favorites':
        return mdiHeartOutline
      case 'collection':
        return mdiFolderOutline
      case 'tag':
        return mdiTagOutline
      case 'library':
      case 'note':
      case 'unclassified':
        return mdiBookshelf
    }
  }
  function typeRange(types: EntryRule['types']) {
    const [first, ...rest] = rules()
    if (first) {
      setRules([{ ...first, types }, ...rest])
    }
    setOffset(0)
  }
  function remember() {
    if (props.visit) {
      props.visit.browse = { query: query(), grid: grid(), offset: offset() }
    }
  }
  function open(item: CardItem) {
    if (item.target.type !== 'collection' && item.target.type !== 'tag') {
      remember()
      props.open(item.target)
    }
  }

  return (
    <section class="catalog-browse flex h-full min-h-0 flex-col">
      <PageBar title={props.title} icon={icon()}>
        <Show when={selection.items().size}>
          {(count) => (
            <>
              <span class="text-xs text-muted-foreground">
                {t('library.selection', { count: count() })}
              </span>
              <Menu onOpenChange={actions.openMenu}>
                <MenuTrigger variant="ghost" size="icon-sm" aria-label={t('actions.more')}>
                  <Icon path={mdiDotsHorizontal} />
                </MenuTrigger>
                <MenuContent>
                  <actions.Items />
                </MenuContent>
              </Menu>
            </>
          )}
        </Show>
      </PageBar>
      <div class="flex flex-wrap items-center gap-2 border-b border-border bg-chrome px-4 py-2">
        <Show when={rules().length === 1 && rules()[0]}>
          {(r) => <TypeRange t={t} value={r().types} change={typeRange} />}
        </Show>
        <Show when={rules().length === 1 && rules()[0]}>
          {(r) => (
            <>
              <Button size="sm" variant="outline" onClick={() => setFilter(true)}>
                {t('library.browse.filter')}
              </Button>
              <Popover>
                <PopoverTrigger size="sm" variant="outline">
                  {t('library.browse.sort')}
                </PopoverTrigger>
                <PopoverContent class="w-64">
                  <QuerySort
                    api={api}
                    types={r().types}
                    value={sort()}
                    change={(v) => {
                      setSort(v)
                      setOffset(0)
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Show when={filter()}>
                <FilterDialog
                  api={api}
                  rule={r()}
                  apply={(next) => {
                    setRules([{ ...r(), filter: next }])
                    setOffset(0)
                  }}
                  close={() => setFilter(false)}
                />
              </Show>
            </>
          )}
        </Show>
        <SearchInput
          class="ms-auto w-44"
          clearLabel={t('controls.search.clear')}
          aria-label={t('controls.search.label')}
          placeholder={t('controls.search.label')}
          value={search()}
          onValueChange={(v) => {
            setSearch(v)
            setOffset(0)
          }}
        />
        <Button
          variant={grid() ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={t('library.browse.grid')}
          onClick={() => setGrid(true)}
        >
          <Icon path={mdiViewGridOutline} />
        </Button>
        <Button
          variant={!grid() ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={t('library.browse.list')}
          onClick={() => setGrid(false)}
        >
          <Icon path={mdiTable} />
        </Button>
      </div>
      <actions.RowMenu class="flex min-h-0 grow flex-col" prepare={prepare}>
        <div
          ref={setViewport}
          class="min-h-0 grow overflow-auto p-4"
          onKeyDown={keys}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              selection.clear()
            }
          }}
        >
          <Show
            when={grid() && viewport()}
            fallback={
              <Show when={table.result()?.value}>
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
                                if (selection.activate(event, { ref })) {
                                  remember()
                                  props.open(ref)
                                }
                              }}
                            >
                              <td>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-pressed={selection.items().has(item.id) ? 'true' : 'false'}
                                >
                                  {item.name}
                                  <Show when={selection.items().has(item.id)}>
                                    <Icon path={mdiCheck} />
                                  </Show>
                                </Button>
                              </td>
                              <td class="text-center">
                                {item.rating == null ? '—' : item.rating / 10}
                              </td>
                              <td class="text-center">
                                {'status' in item
                                  ? t(`library.status.${item.status ?? 'unset'}`)
                                  : '—'}
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
                          disabled={!offset()}
                          variant="ghost"
                          onClick={() => setOffset((n) => n - 100)}
                        >
                          {t('actions.previous')}
                        </Button>
                        <Button
                          disabled={offset() + 100 >= page().total}
                          variant="ghost"
                          onClick={() => setOffset((n) => n + 100)}
                        >
                          {t('actions.next')}
                        </Button>
                      </div>
                    </Show>
                  </>
                )}
              </Show>
            }
          >
            {(root) => (
              <CardShelf
                receipt={props.visit?.receipt}
                api={api}
                viewport={root()}
                layout="grid"
                size="md"
                square={false}
                limit={null}
                source={JSON.stringify(query())}
                showType={
                  new Set(
                    rules()
                      .filter((row) => row.enabled)
                      .flatMap((r) => r.types),
                  ).size > 1
                }
                restore={
                  previous
                    ? {
                        anchor: previous,
                        locate: (signal) => locateCard(api, cardQuery(), previous.target, signal),
                      }
                    : undefined
                }
                remember={(anchor) => {
                  if (props.visit) {
                    props.visit.card = anchor
                  }
                }}
                read={(range, signal) => readCards(api, cardQuery(), range, signal)}
                selected={(item) => selection.items().has(item.target.id)}
                select={(item, event) => {
                  const ref = item.target
                  return (
                    ref.type !== 'tag' &&
                    ref.type !== 'collection' &&
                    selection.activate(event, { ref })
                  )
                }}
                open={open}
              />
            )}
          </Show>
        </div>
      </actions.RowMenu>
      <actions.Dialogs />
    </section>
  )
}
