import { Icon } from '@kisaki3/desktop-ui/icon'
import type { JSX } from '@solidjs/web'
import { Show } from 'solid-js'

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
