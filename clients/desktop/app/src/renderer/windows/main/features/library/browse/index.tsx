import {
  entryTypes,
  type EntryQuery,
  type EntryRef,
  type EntryRule,
  type EntrySort,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { Menu, MenuContent, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { Popover, PopoverContent, PopoverTrigger } from '@kisaki3/desktop-ui/popover'
import {
  mdiBookshelf,
  mdiDotsHorizontal,
  mdiFolderOutline,
  mdiHeartOutline,
  mdiTable,
  mdiTagOutline,
  mdiViewGridOutline,
} from '@mdi/js'
import { createMemo, createSignal, Show } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { CardShelf, locateCard, readCards, type CardItem } from '../../../domain-ui/library/cards'
import { createEntryActions } from '../../../domain-ui/library/entries/actions'
import { EntryFilterDialog } from '../../../domain-ui/library/entries/filters'
import { QuerySort } from '../../../domain-ui/library/entries/filters/sort'
import { createEntrySelection } from '../../../domain-ui/library/entries/selection'
import { EntryTypeRange } from '../../../domain-ui/library/entries/type-range'
import { PageBar } from '../../../domain-ui/page-bar'
import type { LibraryVisit } from '../navigation'
import { EntryTable } from './table'

export function BrowseEntries(props: {
  api: MainClient
  visit?: LibraryVisit | undefined
  query: EntryQuery
  title: string
  open: (ref: EntryRef) => void
}) {
  const { api } = props,
    t = api.t
  const initial = props.visit?.browse?.query ?? props.query
  let previous = props.visit?.card
  let initialAnchor = props.visit?.browse?.grid === false ? props.visit.browse.anchor : undefined
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
  function switchLayout(next: boolean) {
    if (next === grid()) {
      return
    }
    previous = undefined
    initialAnchor = undefined
    setGrid(next)
  }
  function typeRange(types: EntryRule['types']) {
    const [first, ...rest] = rules()
    if (first) {
      setRules([{ ...first, types }, ...rest])
    }
    setOffset(0)
  }
  function remember(anchor?: { ref: EntryRef; top: number }) {
    if (props.visit) {
      props.visit.browse = {
        query: query(),
        grid: grid(),
        offset: offset(),
        ...(anchor && { anchor }),
      }
    }
  }
  function open(item: CardItem) {
    if (item.target.type !== 'collection' && item.target.type !== 'tag') {
      remember()
      props.open(item.target)
    }
  }

  return (
    <section aria-label={props.title} class="@container flex h-full min-h-0 flex-col">
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
          {(r) => <EntryTypeRange t={t} value={r().types} change={typeRange} />}
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
                <EntryFilterDialog
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
          onClick={() => switchLayout(true)}
        >
          <Icon path={mdiViewGridOutline} />
        </Button>
        <Button
          variant={!grid() ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={t('library.browse.list')}
          onClick={() => switchLayout(false)}
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
              <Show when={viewport()}>
                {(root) => (
                  <EntryTable
                    api={api}
                    viewport={root()}
                    query={query()}
                    offset={offset()}
                    selection={selection}
                    restore={initialAnchor}
                    paginate={setOffset}
                    open={(ref, top) => {
                      remember({ ref, top })
                      props.open(ref)
                    }}
                  />
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
                        locate: async (signal) => {
                          if (!previous) {
                            return null
                          }
                          const target = previous.target
                          const at = await locateCard(api, cardQuery(), target, signal)
                          if (
                            !signal.aborted &&
                            at !== null &&
                            target.type !== 'collection' &&
                            target.type !== 'tag'
                          ) {
                            selection.single({ ref: target })
                          }
                          return at
                        },
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
