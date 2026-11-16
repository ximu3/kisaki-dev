/** @fileoverview Records an explicit accelerator into the preference draft and keeps Escape available to abandon recording. */

import { createSignal } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import type { MainClient } from '../../../../infrastructure/api'
import { recordedKey } from '../../../../infrastructure/shortcuts'

/** Existing combinations are retained when adding a binding; clearing is a separate action. */
export function ShortcutRecorder(props: {
  api: MainClient
  keys: readonly string[]
  change: (keys: readonly string[]) => void
}) {
  /** Limits key capture to an explicitly started recording session. */
  const [recording, setRecording] = createSignal(false)
  return (
    <div class="tool-row">
      <span>{props.keys.join(' · ') || props.api.t('runtime.none')}</span>
      <Button
        variant="outline"
        aria-pressed={recording()}
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(event) => {
          if (!recording()) {
            return
          }
          event.preventDefault()
          event.stopImmediatePropagation()
          if (event.key === 'Escape') {
            setRecording(false)
            return
          }
          if (event.repeat) {
            return
          }
          const value = recordedKey(event)
          if (value) {
            props.change([...new Set([...props.keys, value])])
            setRecording(false)
          }
        }}
      >
        {props.api.t(recording() ? 'runtime.pressShortcut' : 'runtime.recordShortcut')}
      </Button>
      <Button variant="ghost" disabled={!props.keys.length} onClick={() => props.change([])}>
        {props.api.t('runtime.shortcutClear')}
      </Button>
    </div>
  )
}
