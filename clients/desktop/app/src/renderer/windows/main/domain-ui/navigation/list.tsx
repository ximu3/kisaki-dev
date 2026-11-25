import { createMemo, createSignal, For, Show, type Component } from 'solid-js'
import { dynamic } from '@solidjs/web'
import { mdiViewDashboardOutline, mdiPinOutline } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import { Button } from '@kisaki3/desktop-ui/button'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { ReorderableList, ReorderableListItem, type ListMove } from '@kisaki3/desktop-ui/list'
import type { Translate } from '@kisaki3/desktop-localization'
import { reportError } from '../../../../infrastructure/notifications'
import { arrangePages, movePages, pageKey } from './order'

export interface NavigationPage {
  ref: PageRef
  title: (t: Translate) => string
  icon: Component
}

export function PageOrder<T extends NavigationPage>(props: {
  t: Translate
  pages: readonly T[]
  order: readonly PageRef[]
  visibleLimit: number
  current?: PageRef | undefined
  open?: (page: T) => void
  change: (order: readonly PageRef[]) => void | Promise<void>
}) {
  const { t } = props
  const arranged = createMemo(() => arrangePages(props.pages, props.order))
  const byId = createMemo(
    () => new Map(arranged().visible.map((page) => [pageKey(page.ref), page])),
  )
  const ids = () => [...byId().keys()]
  const current = () => props.current && pageKey(props.current)
  const [viewport, setViewport] = createSignal<HTMLElement>()

  function adopt(move: ListMove) {
    const next = movePages(arranged(), move)
    if (next) {
      return props.change(next)
    }
  }

  return (
    <Show
      when={ids().length}
      fallback={
        <EmptyState
          class="w-full rounded-md border border-dashed border-border"
          heading={t('runtime.noPages')}
          icon={<Icon path={mdiViewDashboardOutline} class="size-5" />}
        />
      }
    >
      <ReorderableList
        ref={setViewport}
        viewport={viewport}
        variant="plain"
        class="max-h-[min(28rem,65dvh)] w-full overflow-auto"
        aria-label={t('runtime.fields.order')}
        order={ids()}
        labels={{
          first: t('runtime.moveFirst'),
          previous: t('runtime.moveUp'),
          next: t('runtime.moveDown'),
          last: t('runtime.moveLast'),
          moved: (id, position) =>
            t('runtime.pageMoved', { name: byId().get(id)!.title(t), position }),
        }}
        onMove={adopt}
        onMoveError={reportError}
      >
        <For each={ids()}>
          {(id, index) => {
            const page = () => byId().get(id)!
            const title = () => page().title(t)
            const PageIcon = dynamic(() => page().icon)
            return (
              <ReorderableListItem
                value={id}
                moveLabel={t('runtime.movePage', { name: title() })}
                previewLabel={title()}
                icon={!props.open && <PageIcon />}
                title={
                  <Show when={props.open} fallback={title()}>
                    {(open) => (
                      <Button
                        variant="ghost"
                        class="w-full min-w-0 justify-start"
                        aria-current={current() === id ? 'page' : undefined}
                        onClick={() => open()(page())}
                      >
                        <PageIcon />
                        <span class="truncate">{title()}</span>
                      </Button>
                    )}
                  </Show>
                }
                accessory={
                  <Show when={index() < props.visibleLimit}>
                    <Icon
                      path={mdiPinOutline}
                      class="size-3 text-muted-foreground"
                      label={t('runtime.visiblePage')}
                    />
                  </Show>
                }
              />
            )
          }}
        </For>
      </ReorderableList>
    </Show>
  )
}
