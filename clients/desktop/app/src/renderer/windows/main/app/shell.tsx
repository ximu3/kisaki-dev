/** @fileoverview Keeps native window chrome, page content and the fixed management tools at their independent positions. */

import { For, Show, createResource, onCleanup, type ParentProps } from 'solid-js'
import {
  LogOut,
  Info,
  Settings,
  Palette,
  Type,
  MonitorCog,
  ListChecks,
  Minus,
  Square,
  Copy,
  X,
} from 'lucide-solid'
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from '@kisaki3/desktop-ui/menu'
import { Button } from '@kisaki3/desktop-ui/button'
import type { MainClient } from '../../../infrastructure/api'

/** Management surfaces opened above the current page without changing its navigation. */
export type Management = 'preferences' | 'themes' | 'fonts' | 'system' | 'tasks' | 'about'

/** Hosts business pages supplied by their owners and fixed tools that remain available above any page. */
export function AppShell(
  props: ParentProps<{
    api: MainClient
    open: (page: Management) => void
    report: (error: unknown) => void
  }>,
) {
  const { api } = props
  /** Reads the current platform and native maximize state for the title bar. */
  const [windowState, { refetch: refreshWindow }] = createResource(() => api.call('window.state'))
  /** Reads the active count for the fixed task-center trigger. */
  const [active, { refetch: refreshCount }] = createResource(() =>
    api.call(
      'tasks.list',
      { statuses: ['queued', 'running', 'pausing', 'paused', 'cancelling'] },
      { limit: 1, offset: 0 },
    ),
  )
  /** Rereads the active count at history invalidation. */
  const refresh = () => void refreshCount()
  /** Rereads actual native state after a window resize. */
  const resize = () => void refreshWindow()
  api.topics.addEventListener('tasks.changed', refresh)
  window.addEventListener('resize', resize)
  onCleanup(() => {
    api.topics.removeEventListener('tasks.changed', refresh)
    window.removeEventListener('resize', resize)
  })
  const menus = [
    { key: 'preferences', icon: Settings },
    { key: 'themes', icon: Palette },
    { key: 'fonts', icon: Type },
    { key: 'system', icon: MonitorCog },
  ] as const
  return (
    <div class="flex h-screen flex-col overflow-hidden">
      <header data-platform={api.platform} class="titlebar flex shrink-0 items-center">
        <img src="kisaki-app://window/brand/icon.png" alt="Kisaki" class="brand-icon" />
        <div class="grow" />
        <Show when={windowState()?.platform !== 'darwin'}>
          <div class="window-buttons">
            <Button
              variant="ghost"
              aria-label={api.t('runtime.minimize')}
              onClick={() => void api.call('window.minimize').catch(props.report)}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              aria-label={api.t(
                windowState()?.maximized ? 'runtime.restoreWindow' : 'runtime.maximize',
              )}
              onClick={() => void api.call('window.maximize').catch(props.report)}
            >
              {windowState()?.maximized ? <Copy /> : <Square />}
            </Button>
            <Button
              variant="ghost"
              class="window-close"
              aria-label={api.t('actions.close')}
              onClick={() => void api.call('window.close').catch(props.report)}
            >
              <X />
            </Button>
          </div>
        </Show>
      </header>
      <div class="flex min-h-0 grow">
        <aside class="rail flex shrink-0 flex-col items-center">
          <div class="grow" />
          <Button
            variant="ghost"
            class="tool-trigger"
            aria-label={api.t('runtime.tasks')}
            title={api.t('runtime.tasks')}
            onClick={() => props.open('tasks')}
          >
            <ListChecks />
            <Show when={active()?.total}>
              {(n) => <span class="active-count">{n() > 9 ? '9+' : n()}</span>}
            </Show>
          </Button>
          <Menu>
            <MenuTrigger
              variant="ghost"
              class="tool-trigger"
              aria-label={api.t('runtime.appMenu')}
              title={api.t('runtime.appMenu')}
            >
              <Settings />
            </MenuTrigger>
            <MenuContent>
              <For each={menus}>
                {(item) => (
                  <MenuItem onSelect={() => props.open(item.key)}>
                    <item.icon />
                    {api.t(`runtime.${item.key}`)}
                  </MenuItem>
                )}
              </For>
              <MenuSeparator />
              <MenuItem onSelect={() => props.open('about')}>
                <Info />
                {api.t('runtime.about')}
              </MenuItem>
              <MenuItem onSelect={() => void api.call('app.quit').catch(props.report)}>
                <LogOut />
                {api.t('runtime.quit')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </aside>
        <main class="min-w-0 grow">{props.children}</main>
      </div>
    </div>
  )
}
