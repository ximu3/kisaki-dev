/** @fileoverview Routes native page requests and management overlays through the active editors' leave decisions. */

import { createEffect, createSignal, onCleanup } from 'solid-js'
import { createQuery } from '../../../infrastructure/query'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { PreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import {
  parseNativeViewTarget,
  type NativeViewTarget,
  type PageRef,
} from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'
import { createCloseConfirmation, type EditorGuard } from '../../../infrastructure/dialogs/closing'
import { reportError } from '../../../infrastructure/notifications'
import { matchesShortcut } from '../../../infrastructure/shortcuts'
import type { PreferenceEditorGuard } from '../features/preferences/editor'
import { managementTarget, type ManagementTarget, type PageRoute } from './routes'

/** One dialog instance retains its destination through the native exit transition. */
function dialogLayer() {
  const [open, setOpen] = createSignal(false)
  const [instance, setInstance] = createSignal<PromiseWithResolvers<boolean>>()
  const [target, setTarget] = createSignal<ManagementTarget>({ type: 'about' })
  let draft: EditorGuard | PreferenceEditorGuard | undefined
  let presentation: PromiseWithResolvers<boolean> | undefined
  onCleanup(() => presentation?.resolve(false))

  function bind(editor: EditorGuard | PreferenceEditorGuard) {
    draft = editor
    return () => {
      if (draft === editor) {
        draft = undefined
      }
    }
  }

  function show(next: ManagementTarget) {
    presentation?.resolve(false)
    presentation = Promise.withResolvers<boolean>()
    setInstance(presentation)
    setTarget(next)
    setOpen(true)
    return presentation.promise
  }

  return {
    open,
    target,
    show,
    bind,
    instance,
    /** Settles when this instance enters the native modal layer or is withdrawn. */
    whenPresented: () => presentation?.promise ?? false,
    retarget: setTarget,
    draft: () => draft,
    stagedForm: () => (draft && 'stagedForm' in draft ? draft.stagedForm() : undefined),
    close() {
      presentation?.resolve(false)
      presentation = undefined
      setOpen(false)
    },
  }
}

/** Live management surface state scoped to its own mounted form. */
export type DialogLayer = ReturnType<typeof dialogLayer>

/** Owns the content outlet, the two management scopes and the active document shortcuts. */
export function createNavigation(api: MainClient, pages: readonly PageRoute[]) {
  const [page, setPage] = createSignal(pages[0])
  const [target, setTarget] = createSignal<NativeViewTarget>(
    pages[0]?.target ?? { type: 'library' },
  )
  const manager = dialogLayer()
  const resource = dialogLayer()
  const confirmation = createCloseConfirmation(api.t, () => api.call('window.reveal'))
  let navigationRequest = 0

  async function close(layer: DialogLayer) {
    if (await confirmation.ask(layer.draft())) {
      layer.close()
    }
  }

  async function canLeave(signal?: AbortSignal) {
    for (const layer of [resource, manager]) {
      if (layer.open() && !(await confirmation.ask(layer.draft(), signal))) {
        return false
      }
    }
    return true
  }

  async function navigate(next: NativeViewTarget) {
    const surface = managementTarget(next)
    const destination = surface ? undefined : pages.find((route) => route.accepts(next))
    if (!surface && !destination) {
      throw new DesktopError('NotFound', api.t('runtime.unavailable'))
    }

    const request = ++navigationRequest
    if (
      surface &&
      manager.open() &&
      !resource.open() &&
      surface.type === manager.target().type &&
      (surface.type === 'tasks' || (surface.type === 'preferences' && !manager.stagedForm()))
    ) {
      manager.retarget(surface)
      return manager.whenPresented()
    }

    if (!(await canLeave()) || request !== navigationRequest) {
      return false
    }
    resource.close()
    if (surface) {
      return manager.show(surface)
    }

    manager.close()
    setTarget(next)
    setPage(destination)
    return true
  }

  const preferences = createQuery((signal) => api.request(signal, 'preferences.get'))
  const savedPreferences = () => (preferences.error ? undefined : preferences.value)
  createEffect(
    () => preferences.error,
    (error) => {
      if (error) {
        reportError(error)
      }
    },
  )

  async function updatePreferences(input: PreferencesUpdate) {
    preferences.accept(await api.call('preferences.update', input))
  }

  async function reorder(order: readonly PageRef[]) {
    const old = savedPreferences()?.navigation.order
    await updatePreferences({
      changes: { navigation: { order } },
      ...(old?.status === 'ready' && { expected: { navigation: { order: old.value } } }),
    })
  }

  const reload = () => void preferences.reload()
  function keydown(event: KeyboardEvent) {
    if (confirmation.active() || event.defaultPrevented || event.repeat || event.isComposing) {
      return
    }
    const layer = resource.open() ? resource : manager
    const editor = layer.draft()
    if (
      layer.open() &&
      editor?.dirty() &&
      matchesShortcut(event, savedPreferences()?.shortcuts['editor.save'], api.platform)
    ) {
      event.preventDefault()
      // The active form displays its rejection in its fixed feedback slot.
      void (layer.stagedForm()?.submit ?? editor.save)().catch(() => {})
    } else if (
      !manager.open() &&
      matchesShortcut(event, savedPreferences()?.shortcuts['main.preferences'], api.platform)
    ) {
      event.preventDefault()
      void navigate({ type: 'preferences' }).catch(reportError)
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
    if (!(await navigate(parseNativeViewTarget(raw)))) {
      throw new DesktopError('Cancelled', api.t('runtime.keepEditing'))
    }
  })

  return {
    page,
    target,
    manager,
    resource,
    close,
    navigate,
    confirmation,
    preferences: savedPreferences,
    updatePreferences,
    reorder,
  }
}
