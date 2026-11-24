import { createSignal } from 'solid-js'

export interface ShortcutKeypress {
  keys: readonly string[]
  binding: string | null
}

const empty: ShortcutKeypress = { keys: [], binding: null }

export function createShortcutRecording(capture: (event: KeyboardEvent) => ShortcutKeypress) {
  const [keypress, setKeypress] = createSignal(empty)
  const [held, setHeld] = createSignal(false)
  const pressed = new Set<string>()

  function reset() {
    pressed.clear()
    setKeypress(empty)
    setHeld(false)
  }

  function press(event: KeyboardEvent) {
    if (event.repeat) {
      return
    }

    const next = capture(event)
    pressed.add(event.code || event.key)
    if (!held() || next.binding !== null || keypress().binding === null) {
      setKeypress(next)
    }
    setHeld(true)
  }

  function release(event: KeyboardEvent) {
    pressed.delete(event.code || event.key)
    if (pressed.size || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
      return
    }

    setHeld(false)
    if (keypress().binding === null) {
      setKeypress(empty)
    }
  }

  return { keypress, held, reset, press, release }
}
