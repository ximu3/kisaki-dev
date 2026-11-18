/** @fileoverview Presents available pages and adopts reorder requests within their saved slots. */

import { createMemo, For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { PanelsTopLeft, Pin } from 'lucide-solid'
import type { PageRef } from '@kisaki3/desktop-contracts/ui'
import { Button } from '@kisaki3/desktop-ui/button'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { ReorderableList, ReorderableListItem, type ListMove } from '@kisaki3/desktop-ui/list'
import type { MainClient } from '../../../../infrastructure/api'
import { reportError } from '../../../../infrastructure/notifications'
import type { PageRoute } from '../../app/routes'
import { arrangePages, movePages } from './order'

/** Shares one controlled ordered list between the rail's saved order and the preference draft. */
export function PageOrder(props: {
  api: MainClient
  pages: readonly PageRoute[]
  order: readonly PageRef[]
  visibleLimit: number
  current?: string | undefined
  open?: (route: PageRoute) => void
  change: (order: readonly PageRef[]) => void | Promise<void>
}) {
  const { api } = props
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
          heading={api.t('runtime.noPages')}
          icon={<PanelsTopLeft class="size-5" />}
        />
      }
    >
      <ReorderableList
        variant="plain"
        class="max-h-[min(28rem,65dvh)] w-full overflow-auto"
        aria-label={api.t('runtime.fields.order')}
        order={ids()}
        labels={{
          first: api.t('runtime.moveFirst'),
          previous: api.t('runtime.moveUp'),
          next: api.t('runtime.moveDown'),
          last: api.t('runtime.moveLast'),
          moved: (id, position) =>
            api.t('runtime.pageMoved', { name: byId().get(id)!.title(api), position }),
        }}
        onMove={adopt}
        onMoveError={reportError}
      >
        <For each={ids()}>
          {(id, index) => {
            const page = () => byId().get(id)!
            const title = () => page().title(api)
            return (
              <ReorderableListItem
                value={id}
                moveLabel={api.t('runtime.movePage', { name: title() })}
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
                      aria-label={api.t('runtime.visiblePage')}
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
