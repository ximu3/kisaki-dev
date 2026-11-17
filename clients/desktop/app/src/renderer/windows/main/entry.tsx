/** @fileoverview Mounts the main window shell and independently owned management dialogs above its current page. */

import { render } from 'solid-js/web'
import { parseNativeViewTarget, type NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  createSignal,
  createResource,
  Show,
  Switch,
  Match,
  ErrorBoundary,
  onCleanup,
} from 'solid-js'
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@kisaki3/desktop-ui/dialog'
import { connect, type MainClient } from '../../infrastructure/api'
import { createCloseConfirmation, type EditorGuard } from '../../infrastructure/closing'
import { matchesShortcut } from '../../infrastructure/shortcuts'
import { EditorBody } from './domain-ui/editor-footer'
import { AppShell, type Management } from './app/shell'
import { TaskCenter } from './features/tasks'
import { PreferenceEditor } from './features/preferences'
import { Themes } from './features/themes'
import { Fonts } from './features/fonts'
import { SystemSettings } from './features/system'
import { About } from './features/about'
import '../../styles/tailwind.css'
import '../../infrastructure/window.css'
import './styles.css'

/** The two resource managers can also be opened above a still-mounted preference draft. */
type ResourcePage = 'themes' | 'fonts'

/** Discloses the active editor's saving and closing behavior to the window owner. */
function editorGuard() {
  const state: EditorGuard = {
    dirty: false,
    /** Completes immediately until an editor supplies a save operation. */
    save: async () => {},
  }
  return {
    state,
    /** Tracks whether the editor has changes requiring a close decision. */
    dirty(this: void, value: boolean) {
      state.dirty = value
    },
    /** Installs the save operation of the currently mounted editor. */
    onSave(this: void, save: () => Promise<void>) {
      state.save = save
    },
  }
}

/** Keeps focus, dirty checks, navigation and task detail selection scoped to this document. */
function MainWindow(props: { api: MainClient }) {
  const { api } = props
  /** Holds the management dialog opened above the business page. */
  const [page, setPage] = createSignal<Management>()
  /** Holds a resource manager opened above the preference draft. */
  const [nested, setNested] = createSignal<ResourcePage>()
  /** Displays a safe operation failure in the surface that initiated it. */
  const [message, setMessage] = createSignal('')
  /** Keeps the task identity requested by a native navigation action. */
  const [task, setTask] = createSignal<string | null>(null)
  /** Preserves the typed selection supplied by the owning native navigation action. */
  const [destination, setDestination] = createSignal<NativeViewTarget>()
  const baseEditor = editorGuard()
  const nestedEditor = editorGuard()
  const confirmation = createCloseConfirmation(api)
  /** Displays the initiating operation's actual failure. */
  const report = (cause: unknown) =>
    setMessage(cause instanceof Error ? cause.message : String(cause))
  /** Reads the saved shortcut bindings for this document. */
  const [bindings, { refetch: reloadBindings }] = createResource(
    async () => (await api.call('preferences.get')).shortcuts,
  )
  /** Adopts updated key bindings after preference invalidation. */
  const reload = () => void reloadBindings()

  /** Checks every open draft from the frontmost editor before allowing navigation or exit. */
  async function canLeave() {
    if (nested() && !(await confirmation.ask(nestedEditor.state))) {
      return false
    }
    return confirmation.ask(baseEditor.state)
  }

  /** A nested close returns through the native dialog stack to the exact original control. */
  async function close(nestedOnly: boolean) {
    const editor = nestedOnly ? nestedEditor : baseEditor
    if (!(await confirmation.ask(editor.state))) {
      return
    }
    editor.dirty(false)
    setMessage('')
    if (nestedOnly) {
      setNested(undefined)
    } else {
      setPage(undefined)
      setTask(null)
    }
  }

  /** Accepts navigation after the current editors have settled their close decisions. */
  async function open(surface: Management, id: string | null = null, target?: NativeViewTarget) {
    if (page() === surface && !nested() && !baseEditor.state.dirty) {
      setTask(id)
      setDestination(target)
      return true
    }
    if (!(await canLeave())) {
      return false
    }
    baseEditor.dirty(false)
    nestedEditor.dirty(false)
    setNested(undefined)
    setTask(id)
    setDestination(target)
    setPage(surface)
    setMessage('')
    return true
  }
  /** Routes application keyboard preferences only while the native page is the active surface. */
  function keydown(event: KeyboardEvent) {
    if (confirmation.active() || event.repeat) {
      return
    }
    const editor = nested() ? nestedEditor : baseEditor
    if (
      page() &&
      editor.state.dirty &&
      matchesShortcut(event, bindings()?.['editor.save'], api.platform)
    ) {
      event.preventDefault()
      void editor.state.save().catch(report)
      return
    }
    if (!page() && matchesShortcut(event, bindings()?.['main.preferences'], api.platform)) {
      event.preventDefault()
      void open('preferences').catch(report)
    }
  }
  api.topics.addEventListener('window.changed', reload)
  window.addEventListener('keydown', keydown)
  onCleanup(() => {
    api.topics.removeEventListener('window.changed', reload)
    window.removeEventListener('keydown', keydown)
  })
  api.onClose(canLeave)
  api.onNavigate(async (raw) => {
    const target = parseNativeViewTarget(raw)
    let accepted: boolean
    if (target.type === 'tasks') {
      accepted = await open('tasks', target.runId ?? null, target)
    } else if (target.type === 'systemIntegration') {
      accepted = await open('system', null, target)
    } else if (
      target.type === 'preferences' ||
      target.type === 'themes' ||
      target.type === 'fonts' ||
      target.type === 'about'
    ) {
      accepted = await open(target.type, null, target)
    } else {
      throw new DesktopError('NotFound', api.t('runtime.unavailable'))
    }
    if (!accepted) {
      throw new DesktopError('Cancelled', api.t('runtime.keepEditing'))
    }
  })
  /** Renders the same manager and save contract in the app menu or above a preference editor. */
  function Manager(view: {
    page: ResourcePage | undefined
    editor: ReturnType<typeof editorGuard>
  }) {
    return (
      <Switch>
        <Match when={view.page === 'themes'}>
          <Themes
            target={
              !nested() && destination()?.type === 'themes'
                ? (destination() as Extract<NativeViewTarget, { type: 'themes' }>).ref
                : undefined
            }
            api={api}
            dirty={view.editor.dirty}
            onSave={view.editor.onSave}
            report={report}
          />
        </Match>
        <Match when={view.page === 'fonts'}>
          <Fonts
            target={
              !nested() && destination()?.type === 'fonts'
                ? (destination() as Extract<NativeViewTarget, { type: 'fonts' }>).fontId
                : undefined
            }
            api={api}
            dirty={view.editor.dirty}
            onSave={view.editor.onSave}
            report={report}
          />
        </Match>
      </Switch>
    )
  }
  return (
    <>
      <AppShell api={api} open={(dest) => void open(dest).catch(report)} report={report} />
      <Dialog
        open={!!page()}
        onOpenChange={(v) => {
          if (!v) {
            void close(false).catch(report)
          }
        }}
      >
        <DialogContent
          class={page() === 'tasks' ? 'task-dialog' : 'manager-dialog'}
          onCloseRequest={(event) => {
            event.preventDefault()
            void close(false).catch(report)
          }}
        >
          <DialogHeader closeLabel={api.t('actions.close')}>
            <DialogTitle>{api.t(`runtime.${page() ?? 'preferences'}`)}</DialogTitle>
          </DialogHeader>
          <EditorBody class={page() === 'tasks' ? 'task-body' : undefined}>
            <Switch>
              <Match when={page() === 'tasks'}>
                <TaskCenter api={api} target={task()} report={report} />
              </Match>
              <Match when={page() === 'preferences'}>
                <PreferenceEditor
                  field={
                    destination()?.type === 'preferences'
                      ? (destination() as Extract<NativeViewTarget, { type: 'preferences' }>).key
                      : undefined
                  }
                  api={api}
                  dirty={baseEditor.dirty}
                  onSave={baseEditor.onSave}
                  manage={(v) => {
                    setMessage('')
                    setNested(v)
                  }}
                  report={report}
                />
              </Match>
              <Match when={page() === 'system'}>
                <SystemSettings api={api} report={report} />
              </Match>
              <Match when={page() === 'about'}>
                <About api={api} report={report} />
              </Match>
              <Match when={page() === 'themes' || page() === 'fonts'}>
                <Manager page={page() as ResourcePage} editor={baseEditor} />
              </Match>
            </Switch>
            <Show when={!nested() && message()}>
              <p class="problem" role="alert">
                {message()}
              </p>
            </Show>
          </EditorBody>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!nested()}
        onOpenChange={(v) => {
          if (!v) {
            void close(true).catch(report)
          }
        }}
      >
        <DialogContent
          class="manager-dialog"
          onCloseRequest={(event) => {
            event.preventDefault()
            void close(true).catch(report)
          }}
        >
          <DialogHeader closeLabel={api.t('actions.close')}>
            <DialogTitle>{api.t(`runtime.${nested() ?? 'themes'}`)}</DialogTitle>
          </DialogHeader>
          <EditorBody>
            <Manager page={nested()} editor={nestedEditor} />
            <Show when={message()}>
              <p role="alert" class="problem">
                {message()}
              </p>
            </Show>
          </EditorBody>
        </DialogContent>
      </Dialog>
      <confirmation.Content />
      <Show when={!page() && message()}>
        <p class="problem" role="alert">
          {message()}
        </p>
      </Show>
    </>
  )
}

/** This document's verified main-window client. */
const api = await connect('main')
render(
  () => (
    <ErrorBoundary fallback={(error) => <div role="alert">{String(error)}</div>}>
      <MainWindow api={api} />
    </ErrorBoundary>
  ),
  document.getElementById('root')!,
)
await api.ready()
