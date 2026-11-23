import { fromParser, parseValue, nonemptyText } from '../validation'
import { DesktopError } from '../errors'
import * as v from 'valibot'

/** Native action identities whose shortcut settings are persisted by preferences. */
export const shortcutKeys = Object.freeze([
  'main.search',
  'main.preferences',

  'editor.save',

  'reader.find',
  'reader.left',
  'reader.right',
  'reader.up',
  'reader.down',
  'reader.previous',
  'reader.next',
  'reader.fullscreen',
  'reader.addAnnotation',
  'reader.toggleAnnotations',
  'reader.toggleTiming',
  'reader.viewWork',

  'player.playPause',
  'player.seekBackward',
  'player.seekForward',
  'player.volumeUp',
  'player.volumeDown',
  'player.toggleMute',
  'player.toggleSubtitles',
  'player.fullscreen',
  'player.addAnnotation',
  'player.toggleAnnotations',
  'player.toggleTiming',
  'player.viewWork',

  'game.addAnnotation',
  'game.toggleAnnotations',
  'game.togglePanel',
  'game.toggleTiming',
  'game.viewWork',
] as const)

export type ShortcutKey = (typeof shortcutKeys)[number]

export type ShortcutsPreferences = Readonly<Record<ShortcutKey, readonly string[]>>

export type DesktopPlatform = 'win32' | 'darwin' | 'linux'

const modifiers = new Map(
  Object.entries({
    cmd: 'Command',
    command: 'Command',
    ctrl: 'Control',
    control: 'Control',
    cmdorctrl: 'CommandOrControl',
    commandorcontrol: 'CommandOrControl',
    alt: 'Alt',
    option: 'Option',
    altgr: 'AltGr',
    shift: 'Shift',
    super: 'Super',
    meta: 'Super',
  }),
)

const modifierOrder = [
  'CommandOrControl',
  'Command',
  'Control',
  'Alt',
  'Option',
  'AltGr',
  'Shift',
  'Super',
]

const keyNames = [
  'Plus',
  'Space',
  'Tab',
  'Capslock',
  'Numlock',
  'Scrolllock',
  'Backspace',
  'Delete',
  'Insert',
  'Return',

  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape',

  'VolumeUp',
  'VolumeDown',
  'VolumeMute',
  'MediaNextTrack',
  'MediaPreviousTrack',
  'MediaStop',
  'MediaPlayPause',

  'PrintScreen',

  ...Array.from({ length: 10 }, (_, index) => `num${index}`),
  'numdec',
  'numadd',
  'numsub',
  'nummult',
  'numdiv',
]

const keys = new Map(keyNames.map((key) => [key.toLowerCase(), key]))

keys.set('enter', 'Return')

keys.set('esc', 'Escape')

/**
 * Parses and canonicalizes supported case-insensitive Electron accelerator syntax.
 *
 * Explicit modifiers remain distinct from the platform-dependent CommandOrControl choice.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
 */
export function parseAccelerator(input: unknown): string {
  const source = parseValue(nonemptyText, input, 'Invalid accelerator')
  let normalized = source
  if (source === '+') {
    normalized = 'Plus'
  } else if (source.endsWith('++')) {
    normalized = `${source.slice(0, -1)}Plus`
  }

  const parts = normalized.split('+')
  const rawKey = parts.pop()!
  let key = keys.get(rawKey.toLowerCase())
  if (key === undefined) {
    if (/^(?:[a-z0-9]|F[1-9]|F1[0-9]|F2[0-4])$/i.test(rawKey)) {
      key = rawKey.toUpperCase()
    } else if (rawKey.length === 1 && ')!@#$%^&*(:;=<_-,>.?/~`{][|\\}"'.includes(rawKey)) {
      key = rawKey
    }
  }

  const parsed = parts.map((part) => modifiers.get(part.toLowerCase()))
  if (!key || parsed.some((part) => part === undefined) || new Set(parsed).size !== parsed.length) {
    throw new DesktopError('InvalidInput', 'Invalid accelerator')
  }

  return [...modifierOrder.filter((part) => parsed.includes(part)), key].join('+')
}

/** Parses one action's accelerator list and deduplicates canonical combinations. */
export function parseShortcutAccelerators(input: unknown): readonly string[] {
  return parseValue(
    v.pipe(
      v.array(fromParser(parseAccelerator)),
      v.transform((values) => [...new Set(values)]),
    ),
    input,
    'Invalid shortcut accelerators',
  )
}

/** Pair of distinct actions whose effective key combination can overlap in their scopes. */
export interface ShortcutConflict {
  readonly first: ShortcutKey
  readonly second: ShortcutKey
  readonly accelerator: string
}

/** Electron's shifted punctuation carries both the base key code and Shift, independently of its display spelling. */
const shiftedKeyCodes = new Map(
  Object.entries({
    '!': '1',
    '"': "'",
    '#': '3',
    $: '4',
    '%': '5',
    '&': '7',
    '(': '9',
    ')': '0',
    '*': '8',
    Plus: '=',
    ':': ';',
    '<': ',',
    '>': '.',
    '?': '/',
    '@': '2',
    '^': '6',
    _: '-',
    '{': '[',
    '|': '\\',
    '}': ']',
    '~': '`',
  }),
)

/** Resolves a saved spelling to Electron's effective modifier and key identity on this platform. */
export function acceleratorIdentity(accelerator: string, platform: DesktopPlatform): string {
  const parts = parseAccelerator(accelerator).split('+')
  const keyCode = parts.pop()!
  const effective = new Set(
    parts.map((part) => {
      if (part === 'CommandOrControl') {
        return platform === 'darwin' ? 'Super' : 'Control'
      }
      if (part === 'Command') {
        return 'Super'
      }
      if (part === 'Option') {
        return 'Alt'
      }

      return part
    }),
  )
  const shiftedCode = shiftedKeyCodes.get(keyCode)
  if (shiftedCode !== undefined) {
    effective.add('Shift')
  }
  return [...effective].sort().join('+') + ':' + (shiftedCode ?? keyCode)
}

/**
 * Checks effective accelerator collisions in overlapping scopes, including inactive game actions.
 * OS registration is checked at runtime.
 */
export function findShortcutConflicts(
  preferences: ShortcutsPreferences,
  platform: DesktopPlatform,
): readonly ShortcutConflict[] {
  const active: { key: ShortcutKey; scope: string; accelerator: string; identity: string }[] = []
  for (const key of shortcutKeys) {
    for (const accelerator of preferences[key]) {
      active.push({
        key,
        scope: key.split('.')[0]!,
        accelerator,
        identity: acceleratorIdentity(accelerator, platform),
      })
    }
  }

  const conflicts: ShortcutConflict[] = []
  for (let index = 0; index < active.length; index++) {
    const first = active[index]!
    for (const second of active.slice(index + 1)) {
      if (
        first.key !== second.key &&
        first.identity === second.identity &&
        (first.scope === second.scope ||
          ['game', 'editor'].includes(first.scope) ||
          ['game', 'editor'].includes(second.scope))
      ) {
        conflicts.push({ first: first.key, second: second.key, accelerator: first.accelerator })
      }
    }
  }

  return conflicts
}
