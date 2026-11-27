import { onCleanup, type Accessor } from 'solid-js'
import type { MainClient } from '../../../../infrastructure/api'
import { reportError } from '../../../../infrastructure/notifications'
import { createViewQuery } from '../../../../infrastructure/query'

export function createFontRead(api: MainClient, selection: Accessor<{ id: string } | undefined>) {
  const opened = createViewQuery((signal) => {
    const entry = selection()
    if (!entry) {
      return undefined
    }

    let hold: string | undefined
    const release = (id: string) => void api.call('resources.release', id).catch(reportError)
    onCleanup(() => {
      if (hold) {
        release(hold)
      }
    })
    return api.request(signal, 'fonts.open', entry.id).then((font) => {
      if (signal.aborted) {
        release(font.hold)
      } else {
        hold = font.hold
      }
      return font
    })
  })

  return {
    value() {
      const font = opened.result()?.value
      return font?.font.id === selection()?.id ? font : undefined
    },
    error: () => opened.result()?.error,
    loading: () => !!selection() && opened.pending(),
    retry: () => void opened.reload(),
  }
}
