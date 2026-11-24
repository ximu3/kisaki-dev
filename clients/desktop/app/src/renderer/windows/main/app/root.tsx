import { onCleanup, Show } from 'solid-js'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'
import { createCloseConfirmation } from '../../../infrastructure/dialogs/closing'
import { createWindowEditors, WindowEditors } from '../../../infrastructure/dialogs/editors'
import { Notifications, reportError } from '../../../infrastructure/notifications'
import { matchesShortcut } from '../../../infrastructure/shortcuts'
import type { NavigationPage } from '../domain-ui/navigation/list'
import { resolveDestination } from './navigation/destinations'
import { createNavigation } from './navigation/navigate'
import { createShellPreferences } from './preferences'
import { AppShell } from './shell'

export function MainWindow(props: { api: MainClient }) {
  const { api } = props
  const pages: readonly NavigationPage[] = []
  const preferences = createShellPreferences(api)
  const confirmation = createCloseConfirmation(api.t, () => api.call('window.reveal'))
  const editors = createWindowEditors(confirmation.ask)
  const navigation = createNavigation(api, editors, (target, signal) =>
    resolveDestination(api, pages, target, signal),
  )

  async function open(target: NativeViewTarget) {
    try {
      return await navigation.navigate(target)
    } catch (cause) {
      reportError(cause)
      return false
    }
  }

  function keydown(event: KeyboardEvent) {
    if (confirmation.active() || event.defaultPrevented || event.repeat || event.isComposing) {
      return
    }

    const shortcuts = preferences.current()?.shortcuts
    const editor = editors.focused()
    const save = editor?.currentFormAction?.() ?? (editor?.dirty() ? editor.save : undefined)
    if (save && matchesShortcut(event, shortcuts?.['editor.save'], api.platform)) {
      event.preventDefault()
      // The active form displays its rejection in its fixed feedback slot.
      void save().catch(() => {})
    } else if (
      !navigation.current()?.open() &&
      matchesShortcut(event, shortcuts?.['main.preferences'], api.platform)
    ) {
      event.preventDefault()
      void open({ type: 'preferences' })
    }
  }

  window.addEventListener('keydown', keydown)
  onCleanup(() => window.removeEventListener('keydown', keydown))

  return (
    <WindowEditors value={editors}>
      <Notifications t={api.t} appearanceIssues={api.appearanceIssues} />
      <AppShell
        api={api}
        pages={pages}
        preferences={preferences.current()}
        updatePreferences={preferences.update}
        reorder={preferences.reorder}
        open={open}
      />
      <Show when={navigation.current()} keyed>
        {(view) => view.render()}
      </Show>
      <confirmation.Content />
    </WindowEditors>
  )
}
