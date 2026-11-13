/** @fileoverview Declares the fixed preference singleton using defaults supplied by the product owner. */

import { sql } from 'drizzle-orm'
import { blob, check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Preferences } from '@kisaki3/desktop-contracts/preferences'
import { parsePreferences } from '@kisaki3/desktop-contracts/preferences'
import { preferenceColumn, networkPreferences } from '../codecs/preferences'

/**
 * Creates the singleton's column mappings with this application's current read defaults.
 *
 * Defaults affect decoding and first-row initialization, never schema generation or existing rows.
 */
export function createPreferencesTable(defaults: Preferences) {
  const values = parsePreferences(defaults)
  return sqliteTable(
    'preferences',
    {
      id: integer('id').primaryKey().notNull(),
      general: preferenceColumn('general', values)('general').notNull(),
      appearance: preferenceColumn('appearance', values)('appearance').notNull(),
      navigation: preferenceColumn('navigation', values)('navigation').notNull(),
      library: preferenceColumn('library', values)('library').notNull(),
      usage: preferenceColumn('usage', values)('usage').notNull(),
      playback: preferenceColumn('playback', values)('playback').notNull(),
      shortcuts: preferenceColumn('shortcuts', values)('shortcuts').notNull(),
      network: networkPreferences('network').notNull(),
      updates: preferenceColumn('updates', values)('updates').notNull(),
      proxyCredentialsCiphertext: blob('proxy_credentials_ciphertext', { mode: 'buffer' }),
      proxyCredentialsRevision: text('proxy_credentials_revision'),
    },
    (table) => [
      check('preferences_singleton', sql`${table.id} = 1`),
      check(
        'preferences_credentials_pair',
        sql`(${table.proxyCredentialsCiphertext} is null) = (${table.proxyCredentialsRevision} is null)`,
      ),
      check('preferences_credentials_revision', sql`length(${table.proxyCredentialsRevision}) > 0`),
    ],
  )
}
