/** @fileoverview Assembles the main window's management scenes and the resource dialogs they can open. */

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

/** Keeps a lazily loaded scene outside the native modal layer until its module is ready. */
function PendingScene() {
  deferDialogUntil(() => false)
  return null
}

/** Loads one scene on demand and allows a failed module load to be retried. */
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

/** On-demand preference editing and staged forms. */
const PreferenceEditor = loadScene(() =>
  import('../../features/preferences/editor').then((module) => module.PreferenceEditor),
)

/** On-demand task queries, details and history maintenance. */
const TaskCenter = loadScene(() =>
  import('../../features/tasks/center').then((module) => module.TaskCenter),
)

/** On-demand theme catalog and editing. */
const Themes = loadScene(() =>
  import('../../features/themes/manager').then((module) => module.Themes),
)

/** On-demand font catalog and editing. */
const Fonts = loadScene(() => import('../../features/fonts/manager').then((module) => module.Fonts))

/** On-demand system integration and data location settings. */
const SystemSettings = loadScene(() =>
  import('../../features/system/settings').then((module) => module.SystemSettings),
)

/** Reads only the fields belonging to the named destination. */
function targetOf<K extends ManagementTarget['type']>(
  target: ManagementTarget,
  type: K,
): Extract<ManagementTarget, { type: K }> | undefined {
  return target.type === type ? (target as Extract<ManagementTarget, { type: K }>) : undefined
}

/** Binds each management scene to its own inputs and shares resource scenes across the two layers. */
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
