import { createEffect, createSignal, type Accessor } from 'solid-js'
import type { OpenedFont } from '../../../../../shared/window-api'
import type { MainClient } from '../../../../infrastructure/api'
import { reportError } from '../../../../infrastructure/notifications'

/** Updates without holding the previous record's bytes and releases any late reply. */
export function createFontRead(api: MainClient, selection: Accessor<{ id: string } | undefined>) {
  const [value, setValue] = createSignal<OpenedFont>()
  const [error, setError] = createSignal<unknown>()
  const [loading, setLoading] = createSignal(false)
  const [generation, reload] = createSignal(0)

  createEffect(
    () => [generation(), selection()],
    ([, entry]) => {
      setValue(undefined)
      setError(undefined)
      setLoading(!!entry)
      if (!entry) {
        return
      }

      let open = true
      let hold: string | undefined

      void api
        .call('fonts.open', entry.id)
        .then(
          async (font) => {
            if (open) {
              hold = font.hold
              setValue(font)
              setLoading(false)
            } else {
              await api.call('resources.release', font.hold)
            }
          },
          (cause: unknown) => {
            if (open) {
              setError(() => cause)
              setLoading(false)
            }
          },
        )
        .catch(reportError)

      return () => {
        open = false
        if (hold) {
          void api.call('resources.release', hold).catch(reportError)
        }
      }
    },
  )

  return { value, error, loading, retry: () => reload((n) => n + 1) }
}
