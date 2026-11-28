import { dequal } from 'dequal/lite'
import type {
  EntryGroupKey,
  EntryGroupResult,
  EntryListItem,
  EntryQuery,
  EntryRef,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Menu, MenuContent, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { createVirtualizer, VirtualRow } from '@kisaki3/desktop-ui/virtualization'
import {
  mdiCheck,
  mdiChevronRight,
  mdiChevronUp,
  mdiCrosshairsGps,
  mdiDotsHorizontal,
} from '@mdi/js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { errorMessage } from '../../../../../infrastructure/notifications'
import { createViewQuery } from '../../../../../infrastructure/query'
import { createEntryActions } from '../../../domain-ui/library/entries/actions'
import { browseQuery, selectedTypes } from '../../../domain-ui/library/entries/query'
import type { createEntrySelection } from '../../../domain-ui/library/entries/selection'
import { catalogIcon } from '../../../domain-ui/library/icons'
import { LibraryImage } from '../../../domain-ui/library/images/image'
import { libraryRead } from '../../../domain-ui/library/read'
import type { LibraryNavigation } from '../navigation'

const groupId = (group: EntryGroupKey) => (group.type === 'collection' ? group.id : null)

interface Segment {
  group: EntryGroupResult
  start: number
  count: number
  expanded: boolean
}

function GroupHeader(props: {
  api: MainClient
  segment: Segment
  toggle: () => void
  open: (title: string) => void
}) {
  const { api } = props
  const name = libraryRead(api, ['collections'], (signal) => {
    const key = props.segment.group.key
    return key.type === 'unclassified'
      ? api.t('library.pages.unclassified')
      : api
          .request(signal, 'library.collections.get', key.id)
          .then((row) => row?.name ?? api.t('controls.feedback.unavailable'))
  })
  return (
    <div class="flex h-6 min-w-0 items-center rounded-e-md text-xs text-muted-foreground hover:bg-accent/70">
      <button
        type="button"
        class="grid size-6 shrink-0 place-items-center"
        aria-label={name.result()?.value}
        aria-expanded={props.segment.expanded ? 'true' : 'false'}
        onClick={props.toggle}
      >
        <Icon
          path={mdiChevronRight}
          class={props.segment.expanded ? 'size-4 rotate-90' : 'size-4'}
        />
      </button>
      <button
        type="button"
        class="flex h-full min-w-0 grow items-center gap-1.5 pe-2 text-start"
        onClick={() => props.open(name.result()?.value ?? '')}
      >
        <span class="grow truncate">{name.result()?.value}</span>
        <span class="text-muted-foreground/60 tabular-nums">{props.segment.count}</span>
      </button>
    </div>
  )
}

export function ExplorerTree(props: {
  api: MainClient
  query: EntryQuery
  navigation: LibraryNavigation
  selection: ReturnType<typeof createEntrySelection>
}) {
  const { api, navigation, selection } = props
  const actions = createEntryActions(
    api,
    () => [...selection.items().values()],
    (ref) => {
      selection.clear()
      if (ref) {
        navigation.open({ kind: 'entry', entry: ref })
      }
    },
  )
  const t = api.t
  const queryKey = () => JSON.stringify(props.query)
  const groups = libraryRead(api, ['entries', 'collections'], async (signal) => {
    const key = queryKey()
    return { key, ...(await api.request(signal, 'library.entries.groups', props.query)) }
  })
  const snapshot = () => {
    const value = groups.result()?.value
    return value?.key === queryKey() ? value : undefined
  }
  const activeFilter = () =>
    !!props.query.search.trim() ||
    props.query.rules.some((group) => group.enabled && group.filter.conditions.length > 0)
  const [closed, setClosed] = createSignal<ReadonlySet<string | null>>(new Set())
  const [filterClosed, setFilterClosed] = createSignal<ReadonlySet<string | null>>(new Set())
  createEffect(activeFilter, (filtered) => {
    if (!filtered) {
      setFilterClosed(new Set<string | null>())
    }
  })

  const segments = createMemo(
    () => {
      const items: Segment[] = []
      let count = 0
      const collapsed = activeFilter() ? filterClosed() : closed()
      for (const group of snapshot()?.groups ?? []) {
        if (group.status === 'ready' && group.count === 0) {
          continue
        }
        const expanded = !collapsed.has(groupId(group.key))
        const size = group.status === 'ready' ? group.count : 0
        items.push({ group, start: count, count: size, expanded })
        count += 1 + (expanded ? size : 0)
      }
      return { items, count }
    },
    { equals: dequal },
  )
  function expand(group: EntryGroupKey, open: boolean) {
    const change = activeFilter() ? setFilterClosed : setClosed
    change((before) => {
      const next = new Set(before)
      const id = groupId(group)
      if (open) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  function at(index: number) {
    let lo = 0,
      hi = segments().items.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (segments().items[mid]!.start <= index) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    return segments().items[lo - 1]
  }

  const [root, setRoot] = createSignal<HTMLDivElement>()
  const [scrollTop, setScrollTop] = createSignal(0)
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize)
  const virtual = createVirtualizer({
    get viewport() {
      return root()
    },
    get count() {
      return segments().count
    },
    get layout() {
      return queryKey()
    },
    estimateSize: () => 1.625 * rem(),
    overscan: 6,
  })
  const window = libraryRead(api, ['entries', 'collections'], async (signal) => {
    const key = queryKey(),
      layout = segments(),
      range = virtual.range(),
      query = props.query
    const items = new Map<number, EntryListItem>()
    const reads: Promise<void>[] = []
    for (const segment of layout.items) {
      if (!segment.expanded) {
        continue
      }
      const first = segment.start + 1
      const from = Math.max(first, range.first),
        to = Math.min(first + segment.count, range.lastExclusive)
      for (let offset = from; offset < to; offset += 200) {
        const start = offset
        reads.push(
          api
            .request(signal, 'library.entries.list', query, {
              group: segment.group.key,
              offset: start - first,
              limit: Math.min(200, to - start),
              fields: ['primaryImageId'],
            })
            .then((page) => {
              page.items.forEach((item, i) => items.set(start + i, item))
            }),
        )
      }
    }
    await Promise.all(reads)
    return { key, layout, items }
  })
  const itemAt = (index: number) => {
    const result = window.result()?.value
    return result?.key === queryKey() && result.layout === segments()
      ? result.items.get(index)
      : undefined
  }
  const target = () => {
    const page = navigation.current().page
    return page.kind === 'entry' ? page : undefined
  }
  const placed = createViewQuery(async (signal) => {
    const page = target(),
      query = props.query
    if (!page) {
      return null
    }
    const location = await api.request(
      signal,
      'library.entries.locateInGroups',
      query,
      page.entry,
      page.group ?? null,
    )
    return { page, query, location }
  })
  function location() {
    const result = placed.result()?.value
    return result && result.page === target() && result.query === props.query
      ? result.location
      : undefined
  }
  function currentInstance(entry: EntryRef, group: EntryGroupKey) {
    const page = target(),
      instance = location()?.group ?? page?.group
    return (
      page?.entry.type === entry.type &&
      page.entry.id === entry.id &&
      !!instance &&
      groupId(instance) === groupId(group)
    )
  }
  let moved = 0
  onCleanup(() => {
    moved++
  })
  async function focusRow(index: number, focus: boolean, token = ++moved) {
    virtual.scrollToIndex(index, 'nearest')
    if (!focus) {
      return
    }
    const panel = root()
    while (panel?.isConnected && token === moved) {
      const row = panel.querySelector<HTMLElement>(`[data-index="${index}"] button`)
      if (row) {
        row.focus({ preventScroll: true })
        return
      }
      await new Promise<void>((finish) => requestAnimationFrame(() => finish()))
    }
  }
  function locate(focus: boolean) {
    const place = location()
    if (!place) {
      return
    }
    const token = ++moved
    expand(place.group, true)
    requestAnimationFrame(() => {
      const segment = segments().items.find((s) => groupId(s.group.key) === groupId(place.group))
      if (segment && token === moved) {
        void focusRow(segment.start + 1 + place.index, focus, token)
      }
    })
  }
  let followed: unknown
  createEffect(
    () => ({ place: placed.result()?.value, ready: !!snapshot() }),
    ({ place, ready }) => {
      if (ready && place?.location && place !== followed) {
        followed = place
        locate(false)
      }
    },
  )
  const needsLocate = () => {
    const place = location()
    if (!place) {
      return true
    }
    const segment = segments().items.find((s) => groupId(s.group.key) === groupId(place.group))
    if (!segment?.expanded) {
      return true
    }
    const panel = root()
    scrollTop()
    const row = panel?.querySelector<HTMLElement>(
      `[data-index="${segment.start + 1 + place.index}"]`,
    )
    if (!panel || !row) {
      return true
    }
    const rect = row.getBoundingClientRect(),
      area = panel.getBoundingClientRect()
    return rect.top < area.top || rect.bottom > area.bottom
  }
  function activate(event: MouseEvent, item: EntryListItem, group: EntryGroupKey) {
    const ref: EntryRef = { type: item.type, id: item.id }
    if (
      selection.activate(
        event,
        { ref, group },
        segments()
          .items.filter((s) => s.expanded)
          .map((s) => s.group.key),
      )
    ) {
      navigation.open({ kind: 'entry', entry: ref, group })
    }
  }
  function keys(e: KeyboardEvent) {
    if (e.defaultPrevented) {
      return
    }
    selection.keys(e)
    if (e.defaultPrevented) {
      return
    }
    const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-index]') : null
    if (!row) {
      return
    }
    const index = Number(row.dataset.index)
    const next = { Home: 0, End: segments().count - 1, ArrowUp: index - 1, ArrowDown: index + 1 }[
      e.key
    ]
    if (next !== undefined) {
      e.preventDefault()
      void focusRow(Math.max(0, Math.min(next, segments().count - 1)), true)
    }
  }

  return (
    <>
      <Show when={groups.result()?.error ?? window.result()?.error ?? placed.result()?.error}>
        {(err) => (
          <p role="alert" class="p-2 text-xs">
            {errorMessage(err())}
          </p>
        )}
      </Show>
      <div
        ref={setRoot}
        class="min-h-0 grow overflow-y-auto py-1 pe-1"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onKeyDown={keys}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            selection.clear()
          }
        }}
      >
        <div class="relative" style={{ height: virtual.totalSize() + 'px' }}>
          <For each={virtual.items()} keyed={(item) => item.key}>
            {(item) => (
              <VirtualRow virtualizer={virtual} item={item()}>
                <div data-index={item().index} class="min-h-[1.625rem] pb-0.5">
                  <Show when={at(item().index)}>
                    {(segment) => (
                      <Show
                        when={segment().start === item().index}
                        fallback={
                          <Show when={itemAt(item().index)}>
                            {(entry) => (
                              <actions.RowMenu
                                prepare={() =>
                                  actions.capture(
                                    selection.context({
                                      ref: { type: entry().type, id: entry().id },
                                      group: segment().group.key,
                                    }),
                                  )
                                }
                              >
                                <button
                                  type="button"
                                  class="flex h-6 w-full cursor-pointer items-center gap-1.5 rounded-e-md ps-4 pe-2 text-start text-xs text-muted-foreground hover:bg-accent/70 hover:text-foreground [&[data-selected=true]:not([aria-current=true])]:text-foreground aria-[current=true]:bg-accent aria-[current=true]:text-accent-foreground aria-[current=true]:shadow-raised focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
                                  aria-current={
                                    currentInstance(entry(), segment().group.key)
                                      ? 'true'
                                      : undefined
                                  }
                                  data-selected={selection.items().has(entry().id)}
                                  onClick={(e) => activate(e, entry(), segment().group.key)}
                                  onKeyDown={(e) => {
                                    if (e.key === ' ') {
                                      e.preventDefault()
                                      selection.toggle({
                                        ref: { type: entry().type, id: entry().id },
                                        group: segment().group.key,
                                      })
                                    }
                                  }}
                                >
                                  <Show
                                    when={entry().primaryImageId}
                                    fallback={
                                      <Icon
                                        class="size-4 shrink-0 text-muted-foreground/50"
                                        path={catalogIcon[entry().type]}
                                      />
                                    }
                                  >
                                    {(id) => (
                                      <LibraryImage
                                        api={api}
                                        id={id()}
                                        alt=""
                                        class="size-4 shrink-0 rounded-sm border border-border object-cover shadow-raised"
                                      />
                                    )}
                                  </Show>
                                  <span class="min-w-0 grow truncate">{entry().name}</span>
                                  <Show when={selectedTypes(props.query).size > 1}>
                                    <Icon
                                      class="size-3 shrink-0"
                                      path={catalogIcon[entry().type]}
                                    />
                                  </Show>
                                  <span class="inline-flex w-3.5 shrink-0">
                                    <Show when={selection.items().has(entry().id)}>
                                      <Icon class="size-3.5" path={mdiCheck} />
                                    </Show>
                                  </span>
                                </button>
                              </actions.RowMenu>
                            )}
                          </Show>
                        }
                      >
                        <GroupHeader
                          api={api}
                          segment={segment()}
                          toggle={() => expand(segment().group.key, !segment().expanded)}
                          open={(title) =>
                            navigation.open({
                              kind: 'entries',
                              title,
                              query: browseQuery(segment().group.key),
                            })
                          }
                        />
                        <Show
                          when={
                            segment().group.status === 'failed' &&
                            (segment().group as Extract<EntryGroupResult, { status: 'failed' }>)
                          }
                        >
                          {(failure) => (
                            <p role="alert" class="px-2 text-xs text-destructive">
                              {failure().error.message}
                            </p>
                          )}
                        </Show>
                      </Show>
                    )}
                  </Show>
                </div>
              </VirtualRow>
            )}
          </For>
        </div>
      </div>
      <footer class="flex h-8 shrink-0 items-center gap-1 border-t border-border px-3 text-xs text-muted-foreground">
        <span class="me-auto">
          {selection.items().size
            ? t('library.selection', { count: selection.items().size })
            : t('library.browse.count', { count: snapshot()?.total ?? 0 })}
        </span>
        <Show when={selection.items().size}>
          <Menu onOpenChange={actions.openMenu}>
            <MenuTrigger size="icon-sm" variant="ghost" aria-label={t('actions.more')}>
              <Icon path={mdiDotsHorizontal} />
            </MenuTrigger>
            <MenuContent placement="top-end">
              <actions.Items />
            </MenuContent>
          </Menu>
        </Show>
        <Show when={scrollTop() > (root()?.clientHeight ?? 0)}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('library.browse.top')}
            onClick={() => virtual.scrollToIndex(0, 'start')}
          >
            <Icon path={mdiChevronUp} />
          </Button>
        </Show>
        <Show when={target() && needsLocate()}>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={!location()}
            aria-label={t('library.browse.locate')}
            title={t(location() ? 'library.browse.locate' : 'library.browse.outside')}
            onClick={() => locate(true)}
          >
            <Icon path={mdiCrosshairsGps} />
          </Button>
        </Show>
      </footer>
      <actions.Dialogs />
    </>
  )
}
