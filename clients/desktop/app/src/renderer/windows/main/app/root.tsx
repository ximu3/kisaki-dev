/** @fileoverview Mounts the main window's page outlet and management overlays. */

import { Show } from 'solid-js'
import { dynamic } from '@solidjs/web'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'
import { Notifications, reportError } from '../../../infrastructure/notifications'
import { ManagementDialogs } from './management/scenes'
import { createNavigation } from './navigation'
import { createShellPreferences } from './preferences'
import type { PageRoute } from './routes'
import { AppShell } from './shell'

/** Preserves the mounted page and its selection while management dialogs are open. */
export function MainWindow(props: { api: MainClient; pages: readonly PageRoute[] }) {
  const { api } = props
  const preferences = createShellPreferences(api)
  const nav = createNavigation(api, props.pages, () => preferences.current()?.shortcuts)

  async function open(target: NativeViewTarget) {
    try {
      return await nav.navigate(target)
    } catch (cause) {
      reportError(cause)
      return false
    }
  }

  return (
    <>
      <Notifications t={api.t} />
      <AppShell
        api={api}
        pages={props.pages}
        current={nav.page()?.id}
        preferences={preferences.current()}
        updatePreferences={preferences.update}
        reorder={preferences.reorder}
        open={open}
      >
        <Show when={nav.page()}>
          {(page) => {
            const View = dynamic(() => page().view)
            return <View api={api} target={nav.target()} />
          }}
        </Show>
      </AppShell>

      <ManagementDialogs
        api={api}
        pages={props.pages}
        manager={nav.manager.current}
        resource={nav.resource.current}
        openResource={nav.openResource}
        confirmLeave={nav.confirmation.ask}
      />
      <nav.confirmation.Content />
    </>
  )
}
