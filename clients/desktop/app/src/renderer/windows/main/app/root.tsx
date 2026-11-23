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
  const navigation = createNavigation(api, props.pages, () => preferences.current()?.shortcuts)

  async function open(target: NativeViewTarget) {
    try {
      return await navigation.navigate(target)
    } catch (cause) {
      reportError(cause)
      return false
    }
  }

  return (
    <>
      <Notifications t={api.t} appearanceIssues={api.appearanceIssues} />
      <AppShell
        api={api}
        pages={props.pages}
        current={navigation.page()?.id}
        preferences={preferences.current()}
        updatePreferences={preferences.update}
        reorder={preferences.reorder}
        open={open}
      >
        <Show when={navigation.page()}>
          {(page) => {
            const View = dynamic(() => page().view)
            return <View api={api} target={navigation.target()} />
          }}
        </Show>
      </AppShell>

      <ManagementDialogs
        api={api}
        pages={props.pages}
        manager={navigation.manager.current}
        resource={navigation.resource.current}
        openResource={navigation.openResource}
        confirmLeave={navigation.confirmation.ask}
      />
      <navigation.confirmation.Content />
    </>
  )
}
