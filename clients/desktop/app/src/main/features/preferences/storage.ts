import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { eq, sql, type SQL } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseNetworkPreferences } from '@kisaki3/desktop-contracts/network'
import {
  findShortcutConflicts,
  effectiveShortcutBindings,
  type DesktopPlatform,
  type PreferencesChanges,
  type PreferencesExpected,
  type PreferencesSnapshot,
} from '@kisaki3/desktop-contracts/preferences'
import type { Storage } from '../../infrastructure/database'
import type { PreferenceRow } from '../../infrastructure/database/executor'
import {
  usesStoredValue,
  readPreferenceField,
  storedPreferencePaths,
} from '../../infrastructure/database/preference-fields'

export type SavedChanges = Omit<PreferencesChanges, 'network'> & {
  network?: Partial<Omit<PreferencesChanges['network'] & object, 'credentials'>>
}

export function snapshot(row: PreferenceRow): PreferencesSnapshot {
  const { proxyCredentialsRevision, network } = row
  const groups = {
    general: row.general,
    appearance: row.appearance,
    navigation: row.navigation,
    library: row.library,
    usage: row.usage,
    playback: row.playback,
    shortcuts: row.shortcuts,
    updates: row.updates,
  }
  if (network.status === 'invalid') {
    return { ...groups, network }
  }
  try {
    const value = parseNetworkPreferences({
      ...network.value,
      credentials: proxyCredentialsRevision ? { revision: proxyCredentialsRevision } : null,
    })
    return { ...groups, network: { status: 'ready', value } }
  } catch {
    return {
      ...groups,
      network: {
        status: 'invalid',
        error: {
          code: 'DataIntegrityError',
          message: 'The stored network configuration is invalid',
        },
      },
    }
  }
}

function fieldReplacements(
  group: keyof SavedChanges,
  changes: unknown,
  saved: unknown,
  expected: unknown,
) {
  const fields = []
  for (const path of storedPreferencePaths[group]) {
    const value = readPreferenceField(changes, path)
    if (value === undefined) {
      continue
    }

    const baseline = readPreferenceField(expected, path)
    const current = usesStoredValue(group, path)
      ? readPreferenceField(saved, [...path, 'value'])
      : readPreferenceField(saved, path)
    if (baseline !== undefined && !isDeepStrictEqual(current, baseline)) {
      throw new DesktopError('Conflict', 'A preference you edited has changed')
    }
    fields.push({ path, value })
  }
  return fields
}

export function preferenceStorage(storage: Storage) {
  const { db, preferences: table } = storage

  return {
    getPreferences() {
      return snapshot(db.select().from(table).get()!)
    },

    getProxySecret() {
      return db
        .select({
          ciphertext: table.proxyCredentialsCiphertext,
          revision: table.proxyCredentialsRevision,
        })
        .from(table)
        .get()!
    },
    rotateProxySecret(revision: string, ciphertext: Uint8Array) {
      db.update(table)
        .set({ proxyCredentialsCiphertext: Buffer.from(ciphertext) })
        .where(eq(table.proxyCredentialsRevision, revision))
        .run()
    },

    changePreferences(
      changes: SavedChanges,
      expected: PreferencesExpected,
      secret: Uint8Array | null | undefined,
    ) {
      return storage.transaction((tx) => {
        const row = tx.select().from(table).get()!
        const current = snapshot(row)
        const update: Partial<Record<keyof SavedChanges, SQL>> &
          Pick<Partial<PreferenceRow>, 'proxyCredentialsCiphertext' | 'proxyCredentialsRevision'> =
          {}

        let revision = row.proxyCredentialsRevision
        if (secret !== undefined) {
          if (!isDeepStrictEqual(expected.network?.credentials, revision ? { revision } : null)) {
            throw new DesktopError('Conflict', 'Proxy credentials have changed')
          }
          revision = secret === null ? null : randomUUID()
          update.proxyCredentialsCiphertext = secret === null ? null : Buffer.from(secret)
          update.proxyCredentialsRevision = revision
        }

        const savedRoute = row.network.status === 'ready' ? row.network.value : undefined
        for (const group of Object.keys(changes) as (keyof SavedChanges)[]) {
          const saved = group === 'network' ? savedRoute : current[group]
          const fields = fieldReplacements(group, changes[group], saved, expected[group])
          if (!fields.length) {
            continue
          }
          const column = table[group]
          const args = fields.flatMap((field) => {
            const key = '$.' + field.path.map((part) => JSON.stringify(part)).join('.')
            return [sql`${key}`, sql`json(${JSON.stringify(field.value)})`]
          })
          // Store null as JSON null and preserve untouched, even individually invalid, sibling values.
          update[group] =
            sql`json_set(case when json_valid(${column}) then case when json_type(${column})='object' then ${column} else '{}' end else '{}' end, ${sql.join(args, sql`, `)})`
        }

        if (changes.network || secret !== undefined) {
          parseNetworkPreferences({
            ...savedRoute,
            ...changes.network,
            credentials: revision ? { revision } : null,
          })
        }

        if (Object.keys(update).length) {
          tx.update(table).set(update).run()
        }

        const result = snapshot(tx.select().from(table).get()!)
        if (changes.shortcuts) {
          const bindings = effectiveShortcutBindings(result.shortcuts)
          if (findShortcutConflicts(bindings, process.platform as DesktopPlatform).length) {
            throw new DesktopError('InvalidInput', 'Shortcut bindings overlap')
          }
        }
        return result
      }, 'immediate')
    },
  }
}
