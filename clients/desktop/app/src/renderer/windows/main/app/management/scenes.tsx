import { createMemo, Loading, refresh, Show, type Accessor, type Component } from 'solid-js'
import { dynamic } from '@solidjs/web'
import { deferDialogUntil } from '@kisaki3/desktop-ui/dialog'
import type { MainClient } from '../../../../infrastructure/api'
import type { EditorGuard } from '../../../../infrastructure/dialogs/closing'
import { reportError } from '../../../../infrastructure/notifications'
import { About } from '../../features/about'
import type { PageRoute } from '../routes'
import { ManagementDialog, ManagementFailure, type ManagementScene } from './host'
import type { ManagementPresentation, ManagementTarget, ResourceTarget } from './layer'

function PendingScene() {
  deferDialogUntil(() => false)
  return null
}

function loadScene<P extends { api: MainClient }>(load: () => Promise<Component<P>>): Component<P> {
  return (props) => {
    const loaded = createMemo(async () => {
      try {
        return { scene: await load() }
      } catch (error) {
        return { error }
      }
    })
    const Scene = dynamic(() => loaded().scene)

    return (
      <Loading fallback={<PendingScene />}>
        <Show when={'error' in loaded()} fallback={<Scene {...props} />}>
          <ManagementFailure
            t={props.api.t}
            error={loaded().error}
            retry={() => void refresh(loaded)}
          />
        </Show>
      </Loading>
    )
  }
}

const PreferenceEditor = loadScene(() =>
  import('../../features/preferences/editor').then((module) => module.PreferenceEditor),
)

const TaskCenter = loadScene(() =>
  import('../../features/tasks/center').then((module) => module.TaskCenter),
)

const Themes = loadScene(() =>
  import('../../features/themes/manager').then((module) => module.Themes),
)

const Fonts = loadScene(() => import('../../features/fonts/manager').then((module) => module.Fonts))

const SystemSettings = loadScene(() =>
  import('../../features/system/settings').then((module) => module.SystemSettings),
)

function targetOf<K extends ManagementTarget['type']>(
  target: ManagementTarget,
  type: K,
): Extract<ManagementTarget, { type: K }> | undefined {
  return target.type === type ? (target as Extract<ManagementTarget, { type: K }>) : undefined
}

export function ManagementDialogs(props: {
  api: MainClient
  pages: readonly PageRoute[]
  manager: Accessor<ManagementPresentation<ManagementTarget> | undefined>
  resource: Accessor<ManagementPresentation<ResourceTarget> | undefined>
  openResource: (type: ResourceTarget['type']) => Promise<boolean>
  confirmLeave: (guard: EditorGuard) => Promise<boolean>
}) {
  const { api } = props

  const resources = {
    themes: {
      size: 'lg',
      render: (presentation) => (
        <Themes
          api={api}
          target={targetOf(presentation.target(), 'themes')?.ref}
          registerEditor={presentation.registerEditor}
          confirmLeave={props.confirmLeave}
        />
      ),
    },
    fonts: {
      size: 'lg',
      render: (presentation) => (
        <Fonts
          api={api}
          target={targetOf(presentation.target(), 'fonts')?.fontId}
          registerEditor={presentation.registerEditor}
          confirmLeave={props.confirmLeave}
        />
      ),
    },
  } satisfies Record<ResourceTarget['type'], ManagementScene<ManagementTarget>>

  const scenes = {
    ...resources,
    preferences: {
      size: 'xl',
      fill: true,
      render: (presentation) => (
        <PreferenceEditor
          api={api}
          pages={props.pages}
          field={targetOf(presentation.target(), 'preferences')?.key}
          registerEditor={presentation.registerEditor}
          openResource={(type) => void props.openResource(type).catch(reportError)}
        />
      ),
    },
    tasks: {
      size: 'xl',
      fill: true,
      render: (presentation) => (
        <TaskCenter
          api={api}
          target={targetOf(presentation.target(), 'tasks')?.runId ?? null}
          report={reportError}
        />
      ),
    },
    systemIntegration: {
      size: 'md',
      render: () => <SystemSettings api={api} report={reportError} />,
    },
    about: {
      size: 'md',
      render: () => <About api={api} report={reportError} />,
    },
  } satisfies Record<ManagementTarget['type'], ManagementScene<ManagementTarget>>

  return (
    <>
      <ManagementDialog t={api.t} current={props.manager} scene={(target) => scenes[target.type]} />
      <ManagementDialog
        t={api.t}
        current={props.resource}
        scene={(target) => resources[target.type]}
      />
    </>
  )
}
