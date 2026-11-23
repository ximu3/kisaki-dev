import { customType } from 'drizzle-orm/sqlite-core'
import {
  parsePreferences,
  parsePreferencesUpdate,
  type Preferences,
  type PreferencesSnapshot,
} from '@kisaki3/desktop-contracts/preferences'
import {
  parseNetworkPreferences,
  type NetworkPreferences,
} from '@kisaki3/desktop-contracts/network'
import type { StoredDefinition } from '@kisaki3/desktop-contracts/operations'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  hasStoredDefinition,
  readPreferenceField,
  setPreferenceField,
  storedPreferencePaths,
} from '../preference-fields'
import { isInvalidValue, readJsonText, ready, storedJsonColumn } from './json'

/** Preference groups whose ordinary fields can independently adopt their defined defaults. */
type OrdinaryGroup = Exclude<keyof Preferences, 'network'>

/** Non-secret network configuration; credentials occupy protected columns on the singleton. */
export type StoredNetworkPreferences = Omit<NetworkPreferences, 'credentials'>

/** Storage projection before the preference owner attaches opaque credential state. */
export type StoredPreferences = Omit<PreferencesSnapshot, 'network'> & {
  readonly network: StoredDefinition<StoredNetworkPreferences>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseField(path: readonly string[], value: unknown): unknown {
  if (value === undefined) {
    throw new DesktopError('InvalidInput', 'A stored preference field is missing')
  }

  const changes = {}
  setPreferenceField(changes, path, value)
  return readPreferenceField(parsePreferencesUpdate({ changes }).changes, path)
}

function readGroup<K extends OrdinaryGroup>(group: K, source: unknown, defaults: Preferences[K]) {
  const fields = {}
  for (const path of storedPreferencePaths[group]) {
    const explicitFailure = hasStoredDefinition(group, path)
    let value: unknown
    try {
      value = parseField([group, ...path], readPreferenceField(source, path))
      if (explicitFailure) {
        value = ready(value)
      }
    } catch (error) {
      if (!isInvalidValue(error)) {
        throw error
      }
      value = explicitFailure
        ? {
            status: 'invalid',
            error: {
              code: 'DataIntegrityError',
              message: 'The stored preference field is invalid',
            },
          }
        : structuredClone(readPreferenceField(defaults, path))
    }
    setPreferenceField(fields, path, value)
  }
  return fields as PreferencesSnapshot[K]
}

function unwrapSelections(group: OrdinaryGroup, value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const fields = structuredClone(value)
  for (const path of storedPreferencePaths[group]) {
    if (!hasStoredDefinition(group, path)) {
      continue
    }

    const choice = readPreferenceField(fields, path)
    if (!isRecord(choice) || choice.status !== 'ready') {
      throw new DesktopError('InvalidInput', 'Cannot save an invalid preference field')
    }
    setPreferenceField(fields, path, choice.value)
  }
  return fields
}

/**
 * Creates a JSON mapping with strict writes and field-local read results.
 *
 * A decoded snapshot is never an implicit update. The preference owner preserves untouched raw
 * fields when committing an edit; invalid selections can only be explicitly rebuilt or removed.
 */
export function preferenceColumn<K extends OrdinaryGroup>(key: K, defaults: Preferences) {
  function read(source: unknown): PreferencesSnapshot[K] {
    let value: unknown
    try {
      value = readJsonText(source)
    } catch (error) {
      if (!isInvalidValue(error)) {
        throw error
      }
    }

    return readGroup(key, value, defaults[key])
  }

  return customType<{ data: PreferencesSnapshot[K]; driverData: string; jsonData: unknown }>({
    dataType: () => 'text',
    toDriver(value) {
      const input = unwrapSelections(key, value)
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

/** Builds non-secret proxy-configuration columns with explicit validity for execution. */
export const networkPreferences = storedJsonColumn(parseStoredNetwork)

/** Wraps complete validated values for an explicit first-row or whole-configuration insertion. */
export function preparePreferences(input: Preferences): StoredPreferences {
  const values = parsePreferences(input)
  const groups = Object.keys(storedPreferencePaths).filter(
    (group): group is OrdinaryGroup => group !== 'network',
  )
  const storedGroups = Object.fromEntries(
    groups.map((group) => [group, readGroup(group, values[group], values[group])]),
  ) as Omit<PreferencesSnapshot, 'network'>

  return {
    ...storedGroups,
    network: ready({
      mode: values.network.mode,
      endpoint: values.network.endpoint,
      bypassRules: values.network.bypassRules,
    }),
  }
}
