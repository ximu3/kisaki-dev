/** @fileoverview Relates native keyboard events to the saved Electron accelerator vocabulary. */

import { parseAccelerator } from '@kisaki3/desktop-contracts/preferences'
import type { PreferencesSnapshot } from '@kisaki3/desktop-contracts/preferences'

/** DOM key names whose Electron spelling differs. */
const names: Readonly<Record<string, string>> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Return',
  '+': 'Plus',
}

/** Produces a canonical binding only after a nonmodifier key is available. */
export function recordedKey(event: KeyboardEvent) {
  if (
    event.isComposing ||
    ['Alt', 'AltGraph', 'Control', 'Meta', 'Shift', 'Dead', 'Process', 'Unidentified'].includes(
      event.key,
    )
  ) {
    return null
  }
  const modifiers = []
  if (event.metaKey) {
    modifiers.push('Super')
  }
  if (event.ctrlKey) {
    modifiers.push('Control')
  }
  if (event.altKey) {
    modifiers.push('Alt')
  }
  if (event.shiftKey) {
    modifiers.push('Shift')
  }
  modifiers.push(names[event.key] ?? event.key)
  try {
    return parseAccelerator(modifiers.join('+'))
  } catch {
    return null
  }
}

/** Compares an actual event against one enabled shortcut without intercepting IME or composition keys. */
export function matchesShortcut(
  event: KeyboardEvent,
  binding: PreferencesSnapshot['shortcuts'][keyof PreferencesSnapshot['shortcuts']] | undefined,
  platform: string,
) {
  if (event.defaultPrevented || !binding?.enabled || binding.accelerators.status !== 'ready') {
    return false
  }
  const key = recordedKey(event)
  if (!key) {
    return false
  }
  return binding.accelerators.value.some(
    (value) =>
      parseAccelerator(
        value
          .replace('CommandOrControl', platform === 'darwin' ? 'Super' : 'Control')
          .replace('Command', 'Super')
          .replace('Option', 'Alt'),
      ) === key,
  )
}
