/** @fileoverview Stores user appearance resources, onboarding progress and extension installation and private-data facts. */

import { sql } from 'drizzle-orm'
import { blob, check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { parseAppearanceTokens } from '@kisaki3/desktop-contracts/appearance'
import { parseFontFileMetadata } from '@kisaki3/desktop-contracts/fonts'
import { parseOnboardingState } from '@kisaki3/desktop-contracts/onboarding'
import {
  parsePreparedExtensionUpdate,
  parseExtensionArtifactIdentity,
} from '@kisaki3/desktop-contracts/extensions'
import { parseJsonValue } from '@kisaki3/desktop-contracts/json'
import { storedJsonColumn } from '../codecs/json'
import { attachments } from './attachments/metadata'
import { booleanValue, nonempty, idColumn, timestamps } from './constraints'

/** Stores user-owned light and dark theme definitions under one stable theme identity. */
export const themes = sqliteTable(
  'themes',
  {
    id: idColumn(),
    name: text('name').notNull(),
    light: storedJsonColumn(parseAppearanceTokens)('light').notNull(),
    dark: storedJsonColumn(parseAppearanceTokens)('dark').notNull(),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
)

/** Stores user font-family identities independently from their attached font files. */
export const fonts = sqliteTable(
  'fonts',
  {
    id: idColumn(),
    name: text('name').notNull(),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
)

/** Associates a user font with immutable file attachments and their validated font metadata. */
export const fontAttachments = sqliteTable(
  'font_attachments',
  {
    fontId: text('font_id')
      .notNull()
      .references(() => fonts.id, { onDelete: 'cascade' }),
    attachmentId: text('attachment_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'restrict' }),
    metadata: storedJsonColumn(parseFontFileMetadata)('metadata').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fontId, table.attachmentId] }),
    index('font_attachments_attachment').on(table.attachmentId, table.fontId),
  ],
)

/** Stores the single onboarding history value seeded by the initial migration. */
export const onboardingState = sqliteTable(
  'onboarding_state',
  {
    id: integer('id').primaryKey().notNull(),
    state: storedJsonColumn(parseOnboardingState)('state').notNull(),
  },
  (table) => [check('onboarding_state_singleton', sql`${table.id} = 1`)],
)

/** Stores user-confirmed repository addresses and their pinned signing identities. */
export const extensionRepositories = sqliteTable(
  'extension_repositories',
  {
    id: idColumn(),
    url: text('url').notNull(),
    declaredId: text('declared_id').notNull(),
    trustedPublicKey: text('trusted_public_key').notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })],
)

/**
 * Stores installed artifact identity, enabled intent, update selection and prepared replacement
 * independently.
 */
export const installedExtensions = sqliteTable(
  'installed_extensions',
  {
    id: idColumn(),
    version: text('version').notNull(),
    artifact: storedJsonColumn(parseExtensionArtifactIdentity)('artifact').notNull(),
    packagePath: text('package_path').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull(),
    updateRepositoryId: text('update_repository_id').references(() => extensionRepositories.id, {
      onDelete: 'set null',
    }),
    allowPrerelease: integer('allow_prerelease', { mode: 'boolean' }).notNull().default(false),
    preparedUpdate: storedJsonColumn(parsePreparedExtensionUpdate)('prepared_update'),
    preparedPackagePath: text('prepared_package_path'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    booleanValue('installed_extensions_enabled', table.enabled),
    booleanValue('installed_extensions_prerelease', table.allowPrerelease),
    check(
      'installed_extensions_prepared_path',
      sql`(${table.preparedUpdate} is null) = (${table.preparedPackagePath} is null)`,
    ),
    index('installed_extensions_repository').on(table.updateRepositoryId),
  ],
)

/** Stores revisioned extension JSON independently from installation lifetime. */
export const extensionStorage = sqliteTable(
  'extension_storage',
  {
    extensionId: text('extension_id').notNull(),
    key: text('key').notNull(),
    value: storedJsonColumn(parseJsonValue)('value').notNull(),
    revision: text('revision').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.extensionId, table.key] }),
    nonempty('extension_storage_revision', table.revision),
  ],
)

/** Stores revisioned encrypted extension bytes without mixing them with ordinary JSON settings. */
export const extensionSecrets = sqliteTable(
  'extension_secrets',
  {
    extensionId: text('extension_id').notNull(),
    key: text('key').notNull(),
    encryptedValue: blob('encrypted_value', { mode: 'buffer' }).notNull(),
    revision: text('revision').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.extensionId, table.key] }),
    nonempty('extension_secrets_revision', table.revision),
  ],
)
