import { dequal as equalValue } from 'dequal/lite'
import type { ProxyCredentials } from '@kisaki3/desktop-contracts/network'
import type {
  PreferenceKey,
  Preferences,
  PreferencesSnapshot,
  ShortcutKey,
} from '@kisaki3/desktop-contracts/preferences'
import type { Accessor } from 'solid-js'

export interface FieldInput {
  readonly input: unknown
  readonly value: unknown
}

type AtPath<T, K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? AtPath<T[Head], Rest>
    : never
  : K extends keyof T
    ? T[K]
    : never

type PreferenceValue<K extends PreferenceKey> =
  K extends `shortcuts.${infer Key extends ShortcutKey}`
    ? Preferences['shortcuts'][Key]
    : K extends 'network.credentials'
      ? Preferences['network']['credentials'] | ProxyCredentials
      : AtPath<Preferences, K>

type NumericField = {
  [K in PreferenceKey]: PreferenceValue<K> extends number ? K : never
}[PreferenceKey]
type LanguageField = `usage.anime.${'audioLanguages' | 'subtitleLanguages'}`
type ParagraphSpacingField = `usage.${'comic' | 'novel'}.text.paragraphSpacing`

type DraftValue<K extends PreferenceKey> = K extends
  | NumericField
  | LanguageField
  | ParagraphSpacingField
  ? string
  : PreferenceValue<K>

export function fieldPath(key: PreferenceKey) {
  const shortcutPrefix = 'shortcuts.'
  return key.startsWith(shortcutPrefix)
    ? ['shortcuts', key.slice(shortcutPrefix.length)]
    : key.split('.')
}

function availableValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'status' in value) {
    return 'value' in value ? value.value : undefined
  }
  return value
}

export function readField(
  source: PreferencesSnapshot | Preferences | undefined,
  key: PreferenceKey,
) {
  let current: unknown = source
  for (const part of fieldPath(key)) {
    current = availableValue(current)
    current =
      current && typeof current === 'object'
        ? (current as Record<string, unknown>)[part]
        : undefined
  }
  return availableValue(current)
}

function isPagePercentage(key: PreferenceKey) {
  return key.endsWith('.pages.brightness') || key.endsWith('.pages.contrast')
}

function shiftDecimal(value: number, places: number) {
  const [digits, exponent = '0'] = String(value).split('e')
  return Number(`${digits}e${Number(exponent) + places}`)
}

export function displayValue(key: PreferenceKey, value: unknown) {
  if (
    (key === 'usage.anime.audioLanguages' || key === 'usage.anime.subtitleLanguages') &&
    Array.isArray(value)
  ) {
    return value.join(', ')
  }
  if (typeof value !== 'number') {
    return value
  }
  if (key === 'usage.foregroundGracePeriodMs') {
    return String(value / 60_000)
  }
  if (isPagePercentage(key)) {
    return String(shiftDecimal(value, 2))
  }
  return String(value)
}

function numberFromInput(input: string) {
  return input.trim() ? Number(input) : NaN
}

function parseInput(key: Exclude<PreferenceKey, NumericField>, input: unknown) {
  if (typeof input !== 'string') {
    return input
  }
  if (key === 'usage.anime.audioLanguages' || key === 'usage.anime.subtitleLanguages') {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  if (
    (key === 'usage.comic.text.paragraphSpacing' || key === 'usage.novel.text.paragraphSpacing') &&
    input !== 'document'
  ) {
    return numberFromInput(input)
  }
  return input
}

export function createPreferenceFields(
  readInput: (key: PreferenceKey) => unknown,
  writeInput: (key: PreferenceKey, input: FieldInput) => void,
  defaults: Accessor<Preferences | undefined>,
) {
  function read<K extends PreferenceKey>(key: K) {
    return readInput(key) as DraftValue<K> | undefined
  }

  function write<K extends Exclude<PreferenceKey, NumericField>>(key: K, input: DraftValue<K>) {
    writeInput(key, { input, value: parseInput(key, input) })
  }

  function writeNumber(key: NumericField, input: string) {
    let value = numberFromInput(input)
    if (key === 'usage.foregroundGracePeriodMs') {
      value *= 60_000
    }
    if (isPagePercentage(key)) {
      value = shiftDecimal(value, -2)
    }
    writeInput(key, { input, value })
  }

  function canReset(key: PreferenceKey) {
    const values = defaults()
    return !!values && !equalValue(readInput(key), displayValue(key, readField(values, key)))
  }

  function reset(key: PreferenceKey) {
    const value = readField(defaults(), key)
    writeInput(key, { input: displayValue(key, value), value })
  }

  return { read, write, writeNumber, canReset, reset }
}

export type PreferenceFields = ReturnType<typeof createPreferenceFields>
