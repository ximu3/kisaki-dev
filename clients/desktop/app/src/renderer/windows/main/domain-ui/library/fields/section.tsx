import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiPencilOutline } from '@mdi/js'
import type { JSX } from '@solidjs/web'
import { Show } from 'solid-js'

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
