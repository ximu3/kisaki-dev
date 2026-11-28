import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import { For, Show, onSettled, createSignal, lazy } from 'solid-js'
import { mdiBookshelf, mdiChartBoxOutline } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { libraryTarget } from '../features/library/targets'
import { createLibraryNavigation } from '../features/library/navigation'
import { LibraryVisibility } from '../domain-ui/library/selection'
import { EntryEditorDialog } from '../domain-ui/library/entry-editor'
import type { EntryEdit } from '../domain-ui/library/entry-editor/model'
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
import { NavigationRail } from './rail'
const Statistics = lazy(async () => ({
  default: (await import('../features/statistics')).Statistics,
}))
const Library = lazy(async () => ({ default: (await import('../features/library')).Library }))

export function MainWindow(props: { api: MainClient }) {
  const { api } = props
  const library = createLibraryNavigation()
  const [section, setSection] = createSignal<'statistics' | 'library'>('library')
  const [visitedStats, setVisitedStats] = createSignal(false)
  function selectSection(id: 'statistics' | 'library') {
    setSection(id)
    if (id === 'statistics') {
      setVisitedStats(true)
    }
  }
  function showEntry(entry: EntryRef) {
    const fromStatistics = section() === 'statistics'
    selectSection('library')
    library.open(
      { kind: 'entry', entry },
      fromStatistics ? () => selectSection('statistics') : undefined,
    )
  }
  const [edit, setEdit] = createSignal<EntryEdit>()
  const pages: readonly NavigationPage[] = [
    {
      ref: { type: 'native', id: 'library' },
      title: (t) => t('library.pages.library'),
      icon: () => <Icon path={mdiBookshelf} />,
    },
    {
      ref: { type: 'native', id: 'statistics' },
      title: (t) => t('library.pages.statistics'),
      icon: () => <Icon path={mdiChartBoxOutline} />,
    },
  ]

  const preferences = createShellPreferences(api)
  const confirmation = createCloseConfirmation(api.t, () => api.call('window.reveal'))
  const editors = createWindowEditors(confirmation.ask)
  const navigation = createNavigation(api, editors, async (target, signal) => {
    const page = await libraryTarget(api, target, signal)
    if (!page) {
      return resolveDestination(api, pages, target, signal)
    }
    return {
      async show(wait: AbortSignal) {
        wait.throwIfAborted()
        const previous = section()
        selectSection('library')
        try {
          await library.present(page, wait)
        } catch (cause) {
          if (!wait.aborted) {
            selectSection(previous)
          }
          throw cause
        }
      },
    }
  })

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
      !navigation.dialogs().some((dialog) => dialog.open()) &&
      matchesShortcut(event, shortcuts?.['main.preferences'], api.platform)
    ) {
      event.preventDefault()
      void open({ type: 'preferences' })
    }
  }

  onSettled(() => {
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  return (
    <LibraryVisibility value={() => preferences.current()?.library.showNsfw}>
      <WindowEditors value={editors}>
        <Notifications t={api.t} appearanceIssues={api.appearanceIssues} />
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
            <NavigationRail
              api={api}
              pages={pages}
              current={{ type: 'native', id: section() }}
              selectPage={async (ref) => {
                if (!(await editors.canLeave())) {
                  return false
                }
                if (ref.type !== 'native' || (ref.id !== 'statistics' && ref.id !== 'library')) {
                  return false
                }
                if (ref.id === 'library' && section() === 'library') {
                  library.open({ kind: 'showcase' })
                }
                selectSection(ref.id)
                return true
              }}
              addEntry={() => setEdit({ field: 'create', type: 'game' })}
              preferences={preferences.current()}
              updatePreferences={preferences.update}
              open={open}
            />
            <main class="min-w-0 grow overflow-hidden">
              <div class="h-full" hidden={section() !== 'library'}>
                <Library api={api} navigation={library} active={section() === 'library'} />
              </div>
              <Show when={visitedStats()}>
                <div class="h-full" hidden={section() !== 'statistics'}>
                  <Statistics api={api} openWork={showEntry} />
                </div>
              </Show>
            </main>
          </div>
        </div>
        <For each={navigation.dialogs()}>{(dialog) => dialog.render()}</For>
        <EntryEditorDialog
          api={api}
          edit={edit()}
          close={() => setEdit(undefined)}
          saved={(entry) => {
            setEdit(undefined)
            showEntry(entry)
          }}
        />
        <confirmation.Content />
      </WindowEditors>
    </LibraryVisibility>
  )
}
