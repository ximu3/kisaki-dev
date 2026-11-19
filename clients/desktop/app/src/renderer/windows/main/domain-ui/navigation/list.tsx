/** @fileoverview Presents available pages and adopts reorder requests within their saved slots. */

import { createMemo, For, Show, type Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { PanelsTopLeft, Pin } from 'lucide-solid'
import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import { Button } from '@kisaki3/desktop-ui/button'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { ReorderableList, ReorderableListItem, type ListMove } from '@kisaki3/desktop-ui/list'
import type { Translate } from '@kisaki3/desktop-localization'
import { reportError } from '../../../../infrastructure/notifications'
import { arrangePages, movePages } from './order'

/** Stable identity and presentation shared by the navigation rail and its preference field. */
export interface NavigationPage {
  id: string
  title: (t: Translate) => string
  icon: Component
}

/** Shares one controlled ordered list between the rail's saved order and the preference draft. */
export function PageOrder<T extends NavigationPage>(props: {
  t: Translate
  pages: readonly T[]
  order: readonly PageRef[]
  visibleLimit: number
  current?: string | undefined
  open?: (page: T) => void
  change: (order: readonly PageRef[]) => void | Promise<void>
}) {
  const { t } = props
  const arranged = createMemo(() => arrangePages(props.pages, props.order))
  const byId = createMemo(() => new Map(arranged().visible.map((page) => [page.id, page])))
  const ids = () => [...byId().keys()]

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
          icon={<PanelsTopLeft class="size-5" />}
        />
      }
    >
      <ReorderableList
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
            return (
              <ReorderableListItem
                value={id}
                moveLabel={t('runtime.movePage', { name: title() })}
                previewLabel={title()}
                icon={!props.open && <Dynamic component={page().icon} />}
                title={
                  <Show when={props.open} fallback={title()}>
                    {(open) => (
                      <Button
                        variant="ghost"
                        class="w-full min-w-0 justify-start"
                        aria-current={props.current === id ? 'page' : undefined}
                        onClick={() => open()(page())}
                      >
                        <Dynamic component={page().icon} />
                        <span class="truncate">{title()}</span>
                      </Button>
                    )}
                  </Show>
                }
                accessory={
                  <Show when={index() < props.visibleLimit}>
                    <Pin
                      class="size-3 text-muted-foreground"
                      role="img"
                      aria-label={t('runtime.visiblePage')}
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
