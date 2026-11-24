import type { ComponentProps, ParentProps } from 'solid-js'
import { NavigationRail } from './rail'

export function AppShell(props: ParentProps<ComponentProps<typeof NavigationRail>>) {
  return (
    <div class="flex h-dvh flex-col overflow-hidden">
      <header
        data-platform={props.api.platform}
        class="titlebar flex shrink-0 items-center bg-chrome text-chrome-foreground select-none"
      >
        <img
          src="kisaki-app://window/brand/icon.png"
          alt="Kisaki"
          class="titlebar-brand pointer-events-none rounded-md border border-border"
        />
      </header>

      <div class="flex min-h-0 grow border-t border-border">
        <NavigationRail {...props} />
        <main class="min-w-0 grow overflow-hidden">{props.children}</main>
      </div>
    </div>
  )
}
