import { Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import { mdiPencilOutline } from '@mdi/js'

export function PageBar(props: {
  title: string
  icon: string
  heading?: 'h1' | 'h2'
  afterTitle?: JSX.Element
  children?: JSX.Element
}) {
  return (
    <header class="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-chrome px-4">
      <div class="flex min-w-0 grow items-center gap-3">
        <Icon path={props.icon} class="size-5 shrink-0" />
        <Show
          when={props.heading === 'h1'}
          fallback={<h2 class="truncate text-base font-semibold">{props.title}</h2>}
        >
          <h1 class="truncate text-base font-semibold">{props.title}</h1>
        </Show>
        {props.afterTitle}
      </div>
      <Show when={props.children}>
        <div class="flex shrink-0 items-center gap-2">{props.children}</div>
      </Show>
    </header>
  )
}

export function FieldSection(props: {
  title: string
  editLabel?: string
  edit?: () => void
  actions?: JSX.Element
  children: JSX.Element
}) {
  return (
    <section class="min-w-0">
      <div class="group mb-2 flex items-center justify-between gap-2">
        <h3 class="text-xs font-medium text-muted-foreground">{props.title}</h3>
        <div class="flex items-center gap-1">
          {props.actions}
          <Show when={props.edit}>
            <Button
              size="icon-sm"
              variant="ghost"
              class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={props.editLabel}
              onClick={props.edit}
            >
              <Icon path={mdiPencilOutline} class="size-3.5" />
            </Button>
          </Show>
        </div>
      </div>
      {props.children}
    </section>
  )
}
