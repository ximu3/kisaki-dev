import { createMemo, createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '@kisaki3/desktop-ui/popover'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { EntryFilterDialog } from '../../../domain-ui/library/entries/filters'
import { QuerySort } from '../../../domain-ui/library/entries/filters/sort'
import { errorMessage } from '../../../../../infrastructure/notifications'
import {
  mdiViewDashboardOutline,
  mdiFolderOutline,
  mdiHeartOutline,
  mdiFilterOutline,
  mdiSortAscending,
  mdiClose,
} from '@mdi/js'
import {
  workTypes,
  parseEntryQuery,
  type EntryRule,
  type EntrySort,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { browseQuery } from '../../../domain-ui/library/entries/query'
import { EntryTypeRange } from '../../../domain-ui/library/entries/type-range'
import type { LibraryNavigation } from '../navigation'
import { createEntrySelection } from '../../../domain-ui/library/entries/selection'
import { ExplorerTree } from './tree'

export function LibraryExplorer(props: { api: MainClient; navigation: LibraryNavigation }) {
  const { api, navigation } = props,
    t = api.t
  const [types, setTypes] = createSignal<EntryRule['types']>(workTypes)
  const [term, setTerm] = createSignal('')
  const [sort, setSort] = createSignal<EntrySort>({ type: 'scope' })
  const [filter, setFilter] = createSignal<EntryRule['filter']>({ match: 'all', conditions: [] })
  let previous = browseQuery({ type: 'library' }, workTypes)
  const current = createMemo(() => {
    try {
      const value = parseEntryQuery({
        scope: { type: 'library' },
        search: term(),
        sort: sort(),
        rules: [{ enabled: true, types: types(), filter: filter() }],
      })
      previous = value
      return { value, error: undefined }
    } catch (error) {
      return { value: previous, error }
    }
  })
  const query = () => current().value,
    selection = createEntrySelection(api, query)
  const [sortOpen, setSortOpen] = createSignal(false),
    [filterOpen, setFilterOpen] = createSignal(false)
  let filterButton!: HTMLButtonElement
  function clearFilter() {
    setFilter({ match: 'all', conditions: [] })
    filterButton.focus()
  }
  function restore() {
    const v = query()
    setTypes(v.rules[0]!.types)
    setFilter(v.rules[0]!.filter)
    setSort(v.sort)
    setTerm(v.search)
  }
  function go(kind: 'showcase' | 'collections' | 'favorites') {
    selection.clear()
    if (kind === 'favorites') {
      navigation.open({
        kind: 'entries',
        query: browseQuery({ type: 'favorites' }),
        title: t('library.pages.favorites'),
      })
    } else {
      navigation.open({ kind })
    }
  }
  const active = () => {
    const page = navigation.current().page
    return page.kind === 'entries' ? page.query.scope.type : page.kind
  }

  return (
    <aside class="@container flex h-full flex-col border-e border-border bg-background">
      <nav
        class="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2 py-1.5"
        aria-label={t('library.pages.library')}
      >
        <For each={['showcase', 'collections', 'favorites'] as const}>
          {(page) => (
            <button
              class={[
                'flex h-7 items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground aria-[current=page]:shadow-raised',
                page === 'showcase' ? 'grow justify-start px-2.5' : 'w-7 justify-center px-1.5',
              ]}
              aria-current={active() === page ? 'page' : undefined}
              aria-label={t(`library.pages.${page}`)}
              title={page === 'showcase' ? undefined : t(`library.pages.${page}`)}
              onClick={() => go(page)}
            >
              <Icon
                class="size-4"
                path={
                  {
                    showcase: mdiViewDashboardOutline,
                    collections: mdiFolderOutline,
                    favorites: mdiHeartOutline,
                  }[page]
                }
              />
              <Show when={page === 'showcase'}>{t('library.pages.showcase')}</Show>
            </button>
          )}
        </For>
      </nav>
      <div class="space-y-2 border-b border-border bg-chrome px-2 py-2">
        <EntryTypeRange t={t} value={types()} change={setTypes} />
        <div class="flex flex-wrap items-center gap-1.5">
          <SearchInput
            class="min-w-20 flex-1"
            value={term()}
            clearLabel={t('controls.search.clear')}
            aria-label={t('controls.search.label')}
            placeholder={t('controls.search.label')}
            onValueChange={setTerm}
          />
          <Popover open={sortOpen()} onOpenChange={setSortOpen}>
            <PopoverTrigger variant="outline" size="icon-sm" aria-label={t('library.browse.sort')}>
              <Icon path={mdiSortAscending} />
            </PopoverTrigger>
            <PopoverContent placement="bottom-end" class="w-64">
              <QuerySort api={api} types={types()} value={sort()} change={setSort} />
            </PopoverContent>
          </Popover>
          <div class="relative">
            <Button
              ref={(node) => {
                filterButton = node
              }}
              size="icon-sm"
              variant="outline"
              aria-label={t('library.browse.filter')}
              title={t('library.browse.filter')}
              onClick={() => {
                setFilterOpen(true)
              }}
            >
              <Icon path={mdiFilterOutline} />
            </Button>
            <Show when={filter().conditions.length}>
              <button
                class="absolute -end-1 -top-1 rounded-full bg-surface"
                aria-label={t('actions.clear')}
                onClick={clearFilter}
              >
                <Icon path={mdiClose} class="size-3" />
              </button>
            </Show>
          </div>
        </div>
      </div>
      <Show when={current().error}>
        {(e) => (
          <div role="alert" class="px-2 text-xs text-destructive">
            {errorMessage(e())}
            <Button variant="ghost" size="sm" onClick={restore}>
              {t('actions.reset')}
            </Button>
          </div>
        )}
      </Show>
      <ExplorerTree api={api} query={query()} navigation={navigation} selection={selection} />
      <Show when={filterOpen()}>
        <EntryFilterDialog
          api={api}
          rule={{ enabled: true, types: types(), filter: filter() }}
          apply={setFilter}
          close={() => setFilterOpen(false)}
        />
      </Show>
    </aside>
  )
}
