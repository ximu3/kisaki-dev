import type { ShowcaseFields } from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiCheck, mdiChevronLeft, mdiChevronRight } from '@mdi/js'
import { createEffect, createMemo, createSignal, For, onSettled, Show } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../../infrastructure/dialogs/presentation'
import { errorMessage } from '../../../../../infrastructure/notifications'
import { catalogIcon } from '../icons'
import { LibraryImage } from '../images/image'
import { libraryRead } from '../read'
import type { CardAnchor, CardItem } from './query'

export type { CardAnchor, CardItem, CardTarget } from './query'

export { locateCard, readCards } from './query'

export function CatalogCard(props: {
  api: MainClient
  item: CardItem
  showType: boolean
  selected?: boolean | undefined
  open: (item: CardItem, button: HTMLElement, event: MouseEvent) => void
}) {
  const type = () => props.item.target.type
  const typeLabel = () => {
    const kind = type()
    if (kind === 'collection' || kind === 'tag') {
      return props.api.t(kind === 'tag' ? 'library.pages.tags' : 'library.pages.collections')
    }
    return props.api.t(`library.types.${kind}`)
  }
  const square = () => ['organization', 'collection', 'tag'].includes(type())
  return (
    <button
      type="button"
      class="group block w-full min-w-0 rounded-lg text-center focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={props.showType ? props.item.name + ' · ' + typeLabel() : props.item.name}
      data-entry-id={props.item.target.id}
      data-entry-type={props.item.target.type}
      aria-pressed={props.selected === undefined ? undefined : `${props.selected}`}
      onClick={(e) => props.open(props.item, e.currentTarget, e)}
    >
      <span
        class={`relative grid w-full place-items-center overflow-hidden rounded-lg border border-border/40 bg-muted shadow-raised ${square() ? 'aspect-square' : 'aspect-[3/4]'}`}
      >
        <Show
          when={props.item.image}
          fallback={<Icon path={catalogIcon[type()]} class="size-7 text-muted-foreground/50" />}
        >
          {(id) => (
            <LibraryImage
              api={props.api}
              id={id()}
              alt=""
              class={
                type() === 'organization' ? 'size-full object-contain' : 'size-full object-cover'
              }
            />
          )}
        </Show>
        <Show when={props.selected}>
          <span class="absolute start-1 top-1 rounded-sm bg-accent p-0.5 text-accent-foreground">
            <Icon path={mdiCheck} class="size-4" />
          </span>
        </Show>
        <Show when={props.showType}>
          <span
            class="absolute end-1 bottom-1 grid place-items-center rounded-sm bg-background/90 p-0.5"
            title={typeLabel()}
          >
            <Icon path={catalogIcon[type()]} class="size-3.5" />
          </span>
        </Show>
      </span>
      <span class="mt-1 block truncate px-1 text-xs font-medium group-hover:underline">
        {props.item.name}
      </span>
    </button>
  )
}

export function CardShelf(props: {
  receipt?: DialogReceipt | undefined
  api: MainClient
  title?: string
  viewport: HTMLElement
  layout: ShowcaseFields['layout']
  size: ShowcaseFields['itemSize']
  square: boolean
  limit: number | null
  source: string
  read: (range: ListOptions, signal: AbortSignal) => Promise<ListResult<CardItem>>
  showType: boolean
  select?: (item: CardItem, event: MouseEvent) => boolean
  selected?: (item: CardItem) => boolean
  open: (item: CardItem) => void
  restore?:
    | { anchor: CardAnchor; locate: (signal: AbortSignal) => Promise<number | null> }
    | undefined
  remember?: (anchor: CardAnchor) => void
  reveal?: boolean | undefined
  all?: () => void
  edit?: () => void
}) {
  const { api } = props
  const t = api.t
  const [geometry, setGeometry] = createSignal({
    rem: 14,
    width: 0,
    height: 0,
    above: 0,
    scroll: 0,
    visible: false,
  })
  const [last, setLast] = createSignal<{ source: string; total: number }>()
  let section!: HTMLElement, track!: HTMLDivElement, rem!: HTMLSpanElement
  const horizontal = () => props.layout === 'horizontal'
  const cardWidth = () => ({ xs: 5, sm: 6, md: 8, lg: 10, xl: 12 })[props.size] * geometry().rem
  const gap = () => geometry().rem * 0.75
  const rowHeight = () => cardWidth() * (props.square ? 1 : 4 / 3) + geometry().rem * 2.1
  const columns = () => Math.max(1, Math.floor((geometry().width + gap()) / (cardWidth() + gap())))
  const stride = () =>
    horizontal() || columns() === 1
      ? cardWidth() + gap()
      : (geometry().width - cardWidth()) / (columns() - 1)
  const count = () =>
    last()?.source === props.source ? Math.min(last()!.total, props.limit ?? Infinity) : 0

  function measure() {
    const bounds = props.viewport.getBoundingClientRect()
    const rect = track.getBoundingClientRect()
    setGeometry({
      rem: rem.getBoundingClientRect().width,
      width: track.clientWidth,
      height: props.viewport.clientHeight,
      above: Math.max(0, bounds.top - rect.top),
      scroll: track.scrollLeft,
      visible: rect.top <= bounds.bottom && rect.bottom >= bounds.top,
    })
  }
  onSettled(() => {
    const viewport = props.viewport
    const resize = new ResizeObserver(measure)
    const visible = new IntersectionObserver(measure, { root: viewport })
    resize.observe(viewport)
    resize.observe(track)
    resize.observe(rem)
    visible.observe(section)
    viewport.addEventListener('scroll', measure, { passive: true })
    track.addEventListener('scroll', measure, { passive: true })
    measure()
    return () => {
      resize.disconnect()
      visible.disconnect()
      viewport.removeEventListener('scroll', measure)
      track.removeEventListener('scroll', measure)
    }
  })
  const range = createMemo(() => {
    const g = geometry()
    if (!g.visible) {
      return null
    }
    if (horizontal()) {
      return { offset: Math.max(0, Math.floor(g.scroll / stride()) - 1), limit: columns() + 3 }
    }
    return {
      offset: Math.max(0, Math.floor(g.above / rowHeight()) - 1) * columns(),
      limit: (Math.ceil(g.height / rowHeight()) + 3) * columns(),
    }
  })
  const result = libraryRead(api, ['entries', 'collections', 'tags'], async (signal) => {
    const source = props.source,
      window = range()
    if (!window) {
      return null
    }
    const items: CardItem[] = []
    const remaining = Math.max(1, Math.min(window.limit, (props.limit ?? Infinity) - window.offset))
    let total = 0
    do {
      const offset = window.offset + items.length
      const slice = await props.read(
        { offset, limit: Math.min(200, remaining - items.length) },
        signal,
      )
      total = slice.total
      items.push(...slice.items)
      if (!slice.items.length || offset + slice.items.length >= total) {
        break
      }
    } while (items.length < remaining)
    return { source, total, items, offset: window.offset }
  })
  observeDialogTarget(props.receipt, () => ({
    presented: !!result.result()?.value,
    error: result.result()?.error,
  }))
  const value = createMemo(() => {
    const page = result.result()?.value
    return page?.source === props.source ? page : undefined
  })
  createEffect(value, (page) => {
    if (page) {
      setLast({ source: page.source, total: page.total })
    }
  })
  const restore = props.restore
  const [index, setIndex] = createSignal<number | null>()
  onSettled(() => {
    if (!props.reveal && !restore) {
      return
    }
    section.scrollIntoView({ block: 'nearest' })
    if (!restore) {
      return
    }
    const lifetime = new AbortController()
    void restore.locate(lifetime.signal).then(
      (at) => {
        if (!lifetime.signal.aborted) {
          setIndex(at)
        }
      },
      () => {},
    )
    return () => lifetime.abort()
  })
  let restored = false
  createEffect(
    () => ({ at: index(), total: count(), width: geometry().width, page: value() }),
    ({ at, total, width, page }) => {
      if (restored || !restore || at == null || !total || at >= total || !width) {
        return
      }
      const frame = requestAnimationFrame(() => {
        if (!track.isConnected) {
          return
        }
        if (track.clientWidth !== width) {
          measure()
          return
        }
        const bounds = props.viewport.getBoundingClientRect(),
          rect = track.getBoundingClientRect()
        const row = horizontal() ? 0 : Math.floor(at / columns()) * rowHeight()
        const vertical = rect.top - bounds.top + row - restore.anchor.down
        if (horizontal()) {
          track.scrollLeft = at * stride() - restore.anchor.across
        }
        props.viewport.scrollTop += vertical
        const item = page?.items[at - page.offset]
        if (
          item?.target.id === restore.anchor.target.id &&
          item.target.type === restore.anchor.target.type
        ) {
          restored = true
        }
      })
      return () => cancelAnimationFrame(frame)
    },
  )
  onSettled(() => {
    if (!restore) {
      return
    }
    const stop = () => {
        restored = true
      },
      element = props.viewport
    element.addEventListener('wheel', stop, { passive: true })
    element.addEventListener('pointerdown', stop)
    element.addEventListener('keydown', stop)
    return () => {
      element.removeEventListener('wheel', stop)
      element.removeEventListener('pointerdown', stop)
      element.removeEventListener('keydown', stop)
    }
  })
  function remember(item: CardItem, button: HTMLElement, event: MouseEvent) {
    if (props.select && !props.select(item, event)) {
      return
    }
    const card = button.getBoundingClientRect()
    props.remember?.({
      target: item.target,
      across: card.left - track.getBoundingClientRect().left,
      down: card.top - props.viewport.getBoundingClientRect().top,
    })
    props.open(item)
  }
  function scroll(direction: number) {
    track.scrollBy({ left: direction * columns() * stride(), behavior: 'smooth' })
  }

  return (
    <section
      ref={(node) => {
        section = node
      }}
      class="relative min-w-0"
    >
      <span
        ref={(node) => {
          rem = node
        }}
        aria-hidden="true"
        class="invisible pointer-events-none absolute size-[1rem]"
      />
      <Show when={props.title}>
        {(title) => (
          <div class="mb-2 flex items-center justify-between gap-2">
            <h3 class="text-base font-semibold">{title()}</h3>
            <div class="flex items-center gap-1">
              <Show when={props.all && props.limit !== null && (last()?.total ?? 0) > props.limit!}>
                <Button size="sm" variant="ghost" onClick={props.all}>
                  {t('showcase.viewAll')}
                </Button>
              </Show>
              <Show when={horizontal() && count() > 0}>
                <Button
                  aria-label={t('actions.previous')}
                  size="icon-sm"
                  variant="ghost"
                  disabled={geometry().scroll < 1}
                  onClick={() => scroll(-1)}
                >
                  <Icon path={mdiChevronLeft} />
                </Button>
                <Button
                  aria-label={t('actions.next')}
                  size="icon-sm"
                  variant="ghost"
                  disabled={geometry().width + geometry().scroll >= count() * stride() - gap() - 1}
                  onClick={() => scroll(1)}
                >
                  <Icon path={mdiChevronRight} />
                </Button>
              </Show>
              <Show when={props.edit && value()?.total === 0}>
                <Button size="sm" variant="ghost" onClick={props.edit}>
                  {t('actions.edit')}
                </Button>
              </Show>
            </div>
          </div>
        )}
      </Show>
      <Show when={result.result()?.error}>
        {(cause) => (
          <p role="alert">
            {errorMessage(cause())}
            <Button variant="ghost" size="sm" onClick={() => void result.reload()}>
              {t('actions.retry')}
            </Button>
          </p>
        )}
      </Show>
      <div
        ref={(node) => {
          track = node
        }}
        class={horizontal() ? 'overflow-x-auto scrollbar-none' : 'overflow-hidden'}
      >
        <div
          class="relative"
          style={{
            height: count()
              ? rowHeight() * (horizontal() ? 1 : Math.ceil(count() / columns())) + 'px'
              : '1px',
            width: horizontal() ? Math.max(0, count() * stride() - gap()) + 'px' : '100%',
          }}
        >
          <For each={value()?.items ?? []} keyed={(item) => item.target.id}>
            {(item, index) => {
              const at = () => index() + (value()?.offset ?? 0)
              return (
                <div
                  class="absolute start-0 top-0"
                  style={{
                    width: cardWidth() + 'px',
                    transform: `translate(${(horizontal() ? at() : at() % columns()) * stride()}px,${horizontal() ? 0 : Math.floor(at() / columns()) * rowHeight()}px)`,
                  }}
                >
                  <CatalogCard
                    api={api}
                    item={item()}
                    showType={props.showType}
                    selected={props.selected?.(item())}
                    open={remember}
                  />
                </div>
              )
            }}
          </For>
        </div>
      </div>
      <Show when={value()?.total === 0}>
        <p class="text-xs text-muted-foreground italic">{t('showcase.noItems')}</p>
      </Show>
    </section>
  )
}
