import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  type ParentProps,
} from 'solid-js'
import { createQuery } from '../../../infrastructure/query'
import { Ellipsis, ListChecks } from '@lucide/solid'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@kisaki3/desktop-ui/popover'
import type { PreferencesSnapshot, PreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import type { NativeViewTarget, PageRef } from '@kisaki3/desktop-contracts/ui'
import { isTaskTerminal, taskRunStatuses } from '@kisaki3/desktop-contracts/tasks'
import type { MainClient } from '../../../infrastructure/api'
import { reportError } from '../../../infrastructure/notifications'
import { arrangePages } from '../domain-ui/navigation/order'
import { PageOrder } from '../domain-ui/navigation/list'
import { ApplicationMenu } from './menu'
import type { PageRoute } from './routes'

export function AppShell(
  props: ParentProps<{
    api: MainClient
    pages: readonly PageRoute[]
    current: string | undefined
    preferences: PreferencesSnapshot | undefined
    updatePreferences: (input: PreferencesUpdate) => Promise<void>
    reorder: (order: readonly PageRef[]) => Promise<void>
    open: (target: NativeViewTarget) => Promise<boolean>
  }>,
) {
  const { api } = props
  const active = createQuery((signal) =>
    api.request(
      signal,
      'tasks.list',
      { statuses: taskRunStatuses.filter((status) => !isTaskTerminal(status)) },
      { limit: 1, offset: 0 },
    ),
  )
  const refresh = () => void active.reload()
  api.topics.addEventListener('tasks.changed', refresh)
  onCleanup(() => api.topics.removeEventListener('tasks.changed', refresh))

  createEffect(
    () => active.error,
    (error) => {
      if (error) {
        reportError(error)
      }
    },
  )

  const order = () => {
    const saved = props.preferences?.navigation.order
    return saved?.status === 'ready' ? saved.value : []
  }
  const pages = createMemo(() => arrangePages(props.pages, order()).visible)
  const limit = () => props.preferences?.navigation.visibleLimit ?? pages().length
  const pinned = () => pages().slice(0, limit())
  const [more, setMore] = createSignal(false)
  let moreButton!: HTMLButtonElement
  async function select(page: PageRoute) {
    if (await props.open(page.target)) {
      setMore(false)
      moreButton.focus()
    }
  }

  return (
    <div class="flex h-dvh flex-col overflow-hidden">
      <header
        data-platform={api.platform}
        class="titlebar flex shrink-0 items-center bg-chrome text-chrome-foreground select-none"
      >
        <img
          src="kisaki-app://window/brand/icon.png"
          alt="Kisaki"
          class="titlebar-brand pointer-events-none rounded-md border border-border"
        />
      </header>

      <div class="flex min-h-0 grow border-t border-border">
        <aside class="app-rail flex w-13 shrink-0 flex-col items-center border-r border-border bg-chrome text-chrome-foreground">
          <nav class="flex min-h-0 w-full grow flex-col items-center gap-1 overflow-y-auto py-2 [scrollbar-width:none]">
            <For each={pinned()}>
              {(route) => (
                <Tooltip>
                  <TooltipTrigger
                    variant="ghost"
                    size="icon-lg"
                    aria-label={route.title(api.t)}
                    aria-current={props.current === route.id ? 'page' : undefined}
                    class="rail-action size-10"
                    onClick={() => void props.open(route.target)}
                  >
                    <route.icon />
                  </TooltipTrigger>
                  <TooltipContent placement="right">{route.title(api.t)}</TooltipContent>
                </Tooltip>
              )}
            </For>
            <Show when={pages().length > pinned().length}>
              <Popover open={more()} onOpenChange={setMore}>
                <Tooltip>
                  <TooltipTrigger
                    as={PopoverTrigger}
                    ref={(node) => {
                      moreButton = node
                    }}
                    variant="ghost"
                    size="icon-lg"
                    aria-label={api.t('runtime.more')}
                    class="rail-action size-10"
                    data-current={
                      pages()
                        .slice(limit())
                        .some((page) => page.id === props.current) || undefined
                    }
                  >
                    <Ellipsis />
                  </TooltipTrigger>
                  <TooltipContent placement="right">{api.t('runtime.more')}</TooltipContent>
                </Tooltip>
                <PopoverContent
                  placement="right-start"
                  class="w-64"
                  aria-label={api.t('runtime.more')}
                >
                  <PageOrder
                    t={api.t}
                    pages={props.pages}
                    order={order()}
                    visibleLimit={limit()}
                    current={props.current}
                    open={(page) => void select(page)}
                    change={props.reorder}
                  />
                </PopoverContent>
              </Popover>
            </Show>
          </nav>

          <div class="flex shrink-0 flex-col items-center gap-1 py-2">
            <Tooltip>
              <TooltipTrigger
                variant="ghost"
                size="icon-lg"
                class="rail-action size-10"
                aria-label={api.t('runtime.tasks')}
                onClick={() => void props.open({ type: 'tasks' })}
              >
                <ListChecks />
                <Show when={!active.error && active.value?.total}>
                  {(n) => (
                    <span
                      aria-hidden="true"
                      class="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xs leading-none text-primary-foreground"
                    >
                      {n() > 9 ? '9+' : n()}
                    </span>
                  )}
                </Show>
              </TooltipTrigger>
              <TooltipContent placement="right">{api.t('runtime.tasks')}</TooltipContent>
            </Tooltip>

            <ApplicationMenu
              api={api}
              preferences={props.preferences}
              updatePreferences={props.updatePreferences}
              open={props.open}
            />
          </div>
        </aside>
        <main class="min-w-0 grow overflow-hidden">{props.children}</main>
      </div>
    </div>
  )
}
