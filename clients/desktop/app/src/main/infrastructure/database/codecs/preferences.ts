/** @fileoverview Maps preference groups to field-local snapshots while preserving unusable identities and execution choices. */

import { customType } from 'drizzle-orm/sqlite-core'
import { parsePreferences, parsePreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import type { Preferences, PreferencesSnapshot } from '@kisaki3/desktop-contracts/preferences'
import { parseNetworkPreferences } from '@kisaki3/desktop-contracts/network'
import type { NetworkPreferences } from '@kisaki3/desktop-contracts/network'
import type { StoredDefinition } from '@kisaki3/desktop-contracts/operations'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { isInvalidValue, readJsonText, ready, storedJsonColumn } from './json'

/** Preference groups whose ordinary fields can independently adopt their defined defaults. */
type OrdinaryGroup = Exclude<keyof Preferences, 'network'>

/** Non-secret network configuration; credentials occupy protected columns on the singleton. */
export type StoredNetworkPreferences = Omit<NetworkPreferences, 'credentials'>

/** Storage projection before the preference owner attaches opaque credential state. */
export type StoredPreferences = Omit<PreferencesSnapshot, 'network'> & {
  readonly network: StoredDefinition<StoredNetworkPreferences>
}

const identityFields = new Set([
  'general.uiTranslation',
  'appearance.theme',
  'navigation.order',
  'usage.comic.text.font',
  'usage.novel.text.font',
])

/** Recognizes nested preference records without interpreting arrays as groups. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Identifies selections and executable bindings that must retain an explicit invalid state. */
function isProtectedField(path: readonly string[]): boolean {
  return (
    identityFields.has(path.join('.')) ||
    (path[0] === 'shortcuts' && path.at(-1) === 'accelerators')
  )
}

/** Validates one field through its actual public edit boundary and returns the normalized value. */
function parseField(path: readonly string[], value: unknown): unknown {
  if (value === undefined) {
    throw new DesktopError('InvalidInput', 'A stored preference field is missing')
  }
  let input: unknown = value
  for (let index = path.length - 1; index >= 0; index -= 1) {
    input = { [path[index]!]: input }
  }
  let parsed: unknown = parsePreferencesUpdate({ changes: input }).changes
  for (const key of path) {
    parsed = (parsed as Record<string, unknown>)[key]
  }
  return parsed
}

/** Decodes independent fields; invalid identities never replace valid sibling choices. */
function readFields(value: unknown, defaults: unknown, path: readonly string[]): unknown {
  if (isProtectedField(path)) {
    try {
      return ready(parseField(path, value))
    } catch (error) {
      if (!isInvalidValue(error)) {
        throw error
      }
      return {
        status: 'invalid',
        error: { code: 'DataIntegrityError', message: 'The stored preference field is invalid' },
      }
    }
  }
  if (isRecord(defaults) && !('type' in defaults)) {
    const source = isRecord(value) ? value : {}
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        readFields(source[key], fallback, [...path, key]),
      ]),
    )
  }
  try {
    return parseField(path, value)
  } catch (error) {
    if (!isInvalidValue(error)) {
      throw error
    }
    return structuredClone(defaults)
  }
}

/** Unwraps explicitly valid selections before strict full-group write validation. */
function writeFields(value: unknown, defaults: unknown, path: readonly string[]): unknown {
  if (isProtectedField(path)) {
    if (!isRecord(value) || value.status !== 'ready') {
      throw new DesktopError('InvalidInput', 'Cannot save an invalid preference field')
    }
    return value.value
  }
  if (isRecord(defaults) && !('type' in defaults) && isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [
        key,
        writeFields(field, defaults[key], [...path, key]),
      ]),
    )
  }
  return value
}

/**
 * Creates a JSON mapping with strict writes and field-local read results.
 *
 * A decoded snapshot is never an implicit update. The preference owner preserves untouched raw
 * fields when committing an edit; invalid selections can only be explicitly rebuilt or removed.
 */
export function preferenceColumn<K extends OrdinaryGroup>(key: K, defaults: Preferences) {
  /** Reads one group without allowing malformed JSON to hide its ordinary sibling defaults. */
  function read(source: unknown): PreferencesSnapshot[K] {
    let value: unknown
    try {
      value = readJsonText(source)
    } catch (error) {
      if (!isInvalidValue(error)) {
        throw error
      }
    }
    return readFields(value, defaults[key], [key]) as PreferencesSnapshot[K]
  }
  return customType<{ data: PreferencesSnapshot[K]; driverData: string; jsonData: unknown }>({
    /** Keeps each fixed preference group in one SQLite JSON-text column. */
    dataType: () => 'text',
    /** Serializes a complete explicit group after unwrapping its valid selections. */
    toDriver(value) {
      const input = writeFields(value, defaults[key], [key])
      return JSON.stringify(parsePreferences({ ...defaults, [key]: input })[key])
    },
    fromDriver: read,
    fromJson: read,
  })
}

/** Validates non-secret network configuration independently from protected credential columns. */
function parseStoredNetwork(input: unknown): StoredNetworkPreferences {
  if (!isRecord(input) || 'credentials' in input) {
    throw new DesktopError('InvalidInput', 'Proxy credentials are stored separately')
  }
  const value = parseNetworkPreferences({
    ...input,
    credentials: null,
  })
  return { mode: value.mode, endpoint: value.endpoint, bypassRules: value.bypassRules }
}

export const networkPreferences = storedJsonColumn(parseStoredNetwork)

/** Wraps complete validated values for an explicit first-row or whole-configuration insertion. */
export function preparePreferences(input: Preferences): StoredPreferences {
  const values = parsePreferences(input)
  return {
    ...(Object.fromEntries(
      Object.entries(values)
        .filter(([key]) => key !== 'network')
        .map(([key, value]) => [key, readFields(value, value, [key])]),
    ) as Omit<PreferencesSnapshot, 'network'>),
    network: ready({
      mode: values.network.mode,
      endpoint: values.network.endpoint,
      bypassRules: values.network.bypassRules,
    }),
  }
}
