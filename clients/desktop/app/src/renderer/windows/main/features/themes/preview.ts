/** @fileoverview Keeps the application's preview in step with one editor and releases late acquisitions. */

import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'
import type { AppearancePreviewInput } from '@kisaki3/desktop-contracts/appearance'
import type { MainClient } from '../../../../infrastructure/api'
import { reportError } from '../../../../infrastructure/notifications'

/** One uninterrupted preview request, from acquisition through its last delivered revision. */
interface PreviewSession {
  next: AppearancePreviewInput | undefined
  id?: string
  updating: boolean
}

/** Serializes updates and adopts only the newest input queued while main prepares its fonts. */
export function createThemePreview(api: MainClient, input: Accessor<AppearancePreviewInput>) {
  const [enabled, setEnabled] = createSignal(false)
  let session: PreviewSession | undefined

  function release() {
    const previous = session
    session = undefined
    setEnabled(false)
    if (previous?.id) {
      void api.call('resources.release', previous.id).catch(reportError)
    }
  }

  async function deliver(current: PreviewSession) {
    current.updating = true
    try {
      while (session === current && current.next) {
        const value = current.next
        current.next = undefined
        if (current.id) {
          await api.call('themes.updatePreview', current.id, value)
        } else {
          const id = await api.call('themes.preview', value)
          if (session !== current) {
            await api.call('resources.release', id)
            return
          }
          current.id = id
        }
      }
    } catch (cause) {
      if (session === current) {
        if (!current.id) {
          release()
        }
        reportError(cause)
      }
    } finally {
      current.updating = false
      if (session === current && current.next) {
        void deliver(current)
      }
    }
  }

  createEffect(() => {
    if (enabled()) {
      const current = (session ??= { next: undefined, updating: false })
      current.next = input()
      if (!current.updating) {
        void deliver(current)
      }
    }
  })

  function ended(event: Event) {
    if ((event as CustomEvent<string>).detail === session?.id) {
      session = undefined
      setEnabled(false)
    }
  }
  api.topics.addEventListener('preview.ended', ended)
  onCleanup(() => {
    api.topics.removeEventListener('preview.ended', ended)
    release()
  })

  return { enabled, change: (value: boolean) => (value ? setEnabled(true) : release()) }
}
