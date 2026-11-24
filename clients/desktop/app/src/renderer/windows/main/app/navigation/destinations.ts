import { createComponent } from 'solid-js'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../../infrastructure/api'
import type { NavigationPage } from '../../domain-ui/navigation/list'
import { reportError } from '../../../../infrastructure/notifications'
import type { Destination } from './navigate'

export async function resolveDestination(
  api: MainClient,
  pages: readonly NavigationPage[],
  target: NativeViewTarget,
  signal: AbortSignal,
): Promise<Destination> {
  if (target.type === 'tasks') {
    const { TaskCenter, readTaskTarget } = await import('../../features/tasks/center')
    const task = await readTaskTarget(api, target.runId, signal)
    return (view) => createComponent(TaskCenter, { api, task, report: reportError, view })
  }

  if (target.type === 'preferences') {
    const { PreferenceEditor } = await import('../../features/preferences/editor')
    return (view) => createComponent(PreferenceEditor, { api, pages, field: target.key, view })
  }

  if (target.type === 'themes') {
    const { Themes, checkThemeTarget } = await import('../../features/themes/manager')
    await checkThemeTarget(api, target.ref, signal)
    return (view) => createComponent(Themes, { api, target: target.ref, view })
  }

  if (target.type === 'fonts') {
    const { Fonts, checkFontTarget } = await import('../../features/fonts/manager')
    await checkFontTarget(api, target.fontId, signal)
    return (view) => createComponent(Fonts, { api, target: target.fontId, view })
  }

  if (target.type === 'systemIntegration') {
    const { SystemSettings } = await import('../../features/system/settings')
    return (view) => createComponent(SystemSettings, { api, report: reportError, view })
  }

  if (target.type === 'about') {
    const { About } = await import('../../features/about')
    return (view) => createComponent(About, { api, report: reportError, view })
  }

  throw new DesktopError('NotFound', api.t('runtime.unavailable'))
}
