import { createSignal, onCleanup } from 'solid-js'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { PreferencesSnapshot } from '@kisaki3/desktop-contracts/preferences'
import { parseNativeViewTarget, type NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'
import { createCloseConfirmation } from '../../../infrastructure/dialogs/closing'
import { reportError } from '../../../infrastructure/notifications'
import { matchesShortcut } from '../../../infrastructure/shortcuts'
import {
  createManagementLayer,
  isManagementTarget,
  type ManagementTarget,
  type ResourceTarget,
} from './management/layer'
import type { PageRoute } from './routes'

export function createNavigation(
  api: MainClient,
  pages: readonly PageRoute[],
  shortcuts: () => PreferencesSnapshot['shortcuts'] | undefined,
) {
  const [page, setPage] = createSignal(pages[0])
  const [target, setTarget] = createSignal<NativeViewTarget>(
    pages[0]?.target ?? { type: 'library' },
  )
  const confirmation = createCloseConfirmation(api.t, () => api.call('window.reveal'))
  const manager = createManagementLayer<ManagementTarget>(confirmation.ask)
  const resource = createManagementLayer<ResourceTarget>(confirmation.ask)

  async function canLeave(signal?: AbortSignal) {
    const resourceView = resource.active()
    const managerView = manager.active()
    for (const view of [resourceView, managerView]) {
      if (view && !(await view.canLeave(signal))) {
        return false
      }
    }

    const activeResource = resource.active()
    const activeManager = manager.active()
    return (
      !signal?.aborted &&
      (!activeResource || activeResource === resourceView) &&
      (!activeManager || activeManager === managerView)
    )
  }

  let navigation: AbortController | undefined
  async function navigate(next: NativeViewTarget) {
    const surface = isManagementTarget(next) ? next : undefined
    const destination = surface ? undefined : pages.find((route) => route.accepts(next))
    if (!surface && !destination) {
      throw new DesktopError('NotFound', api.t('runtime.unavailable'))
    }

    navigation?.abort()
    const request = new AbortController()
    navigation = request
    try {
      const active = manager.active()
      if (
        surface &&
        active &&
        !resource.active() &&
        surface.type === active.target().type &&
        (surface.type === 'tasks' ||
          (surface.type === 'preferences' && !active.editor()?.currentFormAction?.()))
      ) {
        active.retarget(surface)
        return await active.presented(request.signal)
      }

      if (!(await canLeave(request.signal)) || request.signal.aborted) {
        return false
      }
      resource.active()?.dismiss()
      if (surface) {
        return await manager.show(surface).presented(request.signal)
      }

      manager.active()?.dismiss()
      setTarget(next)
      setPage(destination)
      return true
    } finally {
      if (navigation === request) {
        navigation = undefined
      }
    }
  }

  function openResource(type: ResourceTarget['type']) {
    return resource.show({ type }).presented()
  }

  function keydown(event: KeyboardEvent) {
    if (confirmation.active() || event.defaultPrevented || event.repeat || event.isComposing) {
      return
    }

    const activeManager = manager.active()
    const editor = (resource.active() ?? activeManager)?.editor()
    const save = editor?.currentFormAction?.() ?? (editor?.dirty() ? editor.save : undefined)
    if (save && matchesShortcut(event, shortcuts()?.['editor.save'], api.platform)) {
      event.preventDefault()
      // The active form displays its rejection in its fixed feedback slot.
      void save().catch(() => {})
    } else if (
      !activeManager &&
      matchesShortcut(event, shortcuts()?.['main.preferences'], api.platform)
    ) {
      event.preventDefault()
      void navigate({ type: 'preferences' }).catch(reportError)
    }
  }

  window.addEventListener('keydown', keydown)
  onCleanup(() => {
    window.removeEventListener('keydown', keydown)
    navigation?.abort()
  })
  api.onClose(canLeave)
  api.onNavigate(async (raw) => {
    if (!(await navigate(parseNativeViewTarget(raw)))) {
      throw new DesktopError('Cancelled', api.t('runtime.keepEditing'))
    }
  })

  return { page, target, manager, resource, confirmation, navigate, openResource }
}
