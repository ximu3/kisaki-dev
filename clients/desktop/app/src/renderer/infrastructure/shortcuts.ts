import {
  acceleratorIdentity,
  parseAccelerator,
  type DesktopPlatform,
  type PreferencesSnapshot,
} from '@kisaki3/desktop-contracts/preferences'

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

function eventModifiers(event: KeyboardEvent): string[] {
  const modifiers = []
  if (event.ctrlKey) {
    modifiers.push('Control')
  }
  if (event.altKey) {
    modifiers.push('Alt')
  }
  if (event.shiftKey) {
    modifiers.push('Shift')
  }
  if (event.metaKey) {
    modifiers.push('Super')
  }
  return modifiers
}

/** Encodes the logical key and held modifiers, keeping shifted number-row keys readable. */
function eventAccelerator(event: KeyboardEvent) {
  if (
    event.isComposing ||
    ['Alt', 'AltGraph', 'Control', 'Meta', 'Shift', 'Dead', 'Process', 'Unidentified'].includes(
      event.key,
    )
  ) {
    return null
  }

  const modifiers = eventModifiers(event)
  const shiftedDigit = event.shiftKey && /^Digit[0-9]$/.test(event.code)
  modifiers.push(shiftedDigit ? event.code.slice(-1) : (names[event.key] ?? event.key))

  try {
    return parseAccelerator(modifiers.join('+'))
  } catch {
    return null
  }
}

function matchingBinding(key: string, bindings: readonly string[], platform: DesktopPlatform) {
  const identity = acceleratorIdentity(key, platform)
  return bindings.find((binding) => acceleratorIdentity(binding, platform) === identity)
}

/** Previews held modifiers and recognizes equivalent bindings using the current platform. */
export function captureShortcut(
  event: KeyboardEvent,
  bindings: readonly string[],
  platform: DesktopPlatform,
) {
  const key = eventAccelerator(event)
  if (key === null) {
    return { keys: eventModifiers(event).map((part) => keycap(part, platform)), binding: null }
  }

  const binding = matchingBinding(key, bindings, platform) ?? key
  return { keys: shortcutKeycaps(binding, platform), binding }
}

/** Compares an actual event against the saved binding without intercepting IME or composition keys. */
export function matchesShortcut(
  event: KeyboardEvent,
  binding: PreferencesSnapshot['shortcuts'][keyof PreferencesSnapshot['shortcuts']] | undefined,
  platform: DesktopPlatform,
) {
  if (event.defaultPrevented || binding?.status !== 'ready' || !binding.value.length) {
    return false
  }
  const key = eventAccelerator(event)
  return key !== null && matchingBinding(key, binding.value, platform) !== undefined
}

function keycap(key: string, platform: DesktopPlatform) {
  const mac = platform === 'darwin'
  const systemLabel = { darwin: '⌘', win32: 'Win', linux: 'Super' }[platform]
  const labels: Readonly<Record<string, string>> = {
    CommandOrControl: mac ? '⌘' : 'Ctrl',
    Control: mac ? '⌃' : 'Ctrl',
    Super: systemLabel,
    Alt: mac ? '⌥' : 'Alt',
    Shift: mac ? '⇧' : 'Shift',
  }
  return labels[key] ?? key
}

export function shortcutKeycaps(value: string, platform: DesktopPlatform): readonly string[] {
  return value.split('+').map((part) => keycap(part, platform))
}
