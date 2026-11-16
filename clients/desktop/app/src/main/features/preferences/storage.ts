/** @fileoverview Commits field-local preference edits against their original values on the SQLite worker. */

import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { eq, sql, type SQL } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseNetworkPreferences } from '@kisaki3/desktop-contracts/network'
import {
  findShortcutConflicts,
  shortcutKeys,
  type DesktopPlatform,
  type PreferencesChanges,
  type PreferencesExpected,
  type PreferencesSnapshot,
  type ShortcutsPreferences,
} from '@kisaki3/desktop-contracts/preferences'
import type { Storage } from '../../infrastructure/database'
import type { PreferenceRow } from '../../infrastructure/database/executor'

/** Nonsecret changes sent to the worker after credentials are encrypted in the main process. */
export type SavedChanges = Omit<PreferencesChanges, 'network'> & {
  network?: Partial<Omit<PreferencesChanges['network'] & object, 'credentials'>>
}

/** Reads only public preference values. Ciphertext stays on the protected path. */
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

/** Own records form edit groups; tagged choices, arrays and scalars replace one entire field. */
function isGroup(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !('type' in value)
}

/** Lists canonical field replacements and checks only the baselines explicitly supplied by this edit. */
function replacements(
  changes: Record<string, unknown>,
  current: Record<string, unknown>,
  expected: Record<string, unknown>,
  path: string[] = [],
): Array<{ path: string[]; value: unknown }> {
  return Object.entries(changes).flatMap(([key, value]) => {
    const keys = [...path, key]
    const saved = current[key]
    if (isGroup(value)) {
      return replacements(
        value,
        isGroup(saved) ? saved : {},
        isGroup(expected[key]) ? expected[key] : {},
        keys,
      )
    }
    const original = isGroup(saved) && 'status' in saved ? saved.value : saved
    if (Object.hasOwn(expected, key) && !isDeepStrictEqual(original, expected[key])) {
      throw new DesktopError('Conflict', 'A preference you edited has changed')
    }
    return [{ path: keys, value }]
  })
}

/** Creates complete preference read/write operations for the application database. */
export function preferenceStorage(storage: Storage) {
  const { db, preferences: table } = storage
  return {
    /** Returns one saved singleton without disclosing credential bytes. */
    getPreferences() {
      return snapshot(db.select().from(table).get()!)
    },
    /** Reads the protected pair only for adoption by the host network. */
    getProxySecret() {
      return db
        .select({
          ciphertext: table.proxyCredentialsCiphertext,
          revision: table.proxyCredentialsRevision,
        })
        .from(table)
        .get()!
    },
    /** Rewraps only the revision whose decryption asked for key rotation. */
    rotateProxySecret(revision: string, ciphertext: Uint8Array) {
      db.update(table)
        .set({ proxyCredentialsCiphertext: Buffer.from(ciphertext) })
        .where(eq(table.proxyCredentialsRevision, revision))
        .run()
    },
    /** Checks baselines, validates affected cross-field constraints and commits the submitted fields atomically. */
    changePreferences(
      changes: SavedChanges,
      expected: PreferencesExpected,
      secret: Uint8Array | null | undefined,
    ) {
      return db.transaction((tx) => {
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

        for (const group of Object.keys(changes) as (keyof SavedChanges)[]) {
          const savedRoute = row.network.status === 'ready' ? row.network.value : {}
          const saved = group === 'network' ? savedRoute : current[group]
          const fields = replacements(
            changes[group] as Record<string, unknown>,
            saved as Record<string, unknown>,
            (expected[group] ?? {}) as Record<string, unknown>,
          )
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
            ...(row.network.status === 'ready' ? row.network.value : {}),
            ...changes.network,
            credentials: revision ? { revision } : null,
          })
        }
        if (Object.keys(update).length) {
          tx.update(table).set(update).run()
        }
        const result = snapshot(tx.select().from(table).get()!)
        if (changes.shortcuts) {
          const bindings = Object.fromEntries(
            shortcutKeys.map((key) => {
              const saved = result.shortcuts[key]
              return [
                key,
                {
                  enabled: saved.enabled,
                  accelerators:
                    saved.accelerators.status === 'ready' ? saved.accelerators.value : [],
                },
              ]
            }),
          ) as ShortcutsPreferences
          if (findShortcutConflicts(bindings, process.platform as DesktopPlatform).length) {
            throw new DesktopError('InvalidInput', 'Shortcut bindings overlap')
          }
        }
        return result
      })
    },
  }
}
