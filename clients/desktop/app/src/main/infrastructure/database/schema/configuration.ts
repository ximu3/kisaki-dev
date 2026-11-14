/** @fileoverview Stores source profiles, scanner configuration and independently saved showcase sections. */

import { sql } from 'drizzle-orm'
import {
  primaryKey,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { entryTypes, workTypes, parseShowcaseQuery } from '@kisaki3/desktop-contracts/library'
import { parseMetadataProfileDefinition } from '@kisaki3/desktop-contracts/metadata'
import type { MetadataProfileDefinition } from '@kisaki3/desktop-contracts/metadata'
import { parseScanDefinitionShape } from '@kisaki3/desktop-contracts/scanner'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { languages } from '../codecs/catalog'
import { isInvalidValue, storedJsonColumn } from '../codecs/json'
import { booleanValue, enumValue, idColumn, safeInteger, timestamps } from './constraints'

/**
 * Parses a profile's JSON value for its supported root shape.
 *
 * The profile owner additionally checks the selected entry type when committing a full row.
 */
function parseProfileDefinition(input: unknown): MetadataProfileDefinition {
  for (const type of entryTypes) {
    try {
      return parseMetadataProfileDefinition(type, input)
    } catch (error) {
      if (!isInvalidValue(error)) {
        throw error
      }
    }
  }
  throw new DesktopError('InvalidInput', 'Invalid metadata profile definition')
}

/** Stores source-adoption definitions and the optional default profile for each entry type. */
export const metadataProfiles = sqliteTable(
  'metadata_profiles',
  {
    id: idColumn(),
    name: text('name').notNull(),
    description: text('description'),
    entryType: text('entry_type', { enum: entryTypes }).notNull(),
    preferredLanguages: languages('preferred_languages').notNull().default([]),
    definition: storedJsonColumn(parseProfileDefinition)('definition').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('metadata_profiles_id_type').on(table.id, table.entryType),
    enumValue('metadata_profiles_type', table.entryType, entryTypes),
    booleanValue('metadata_profiles_default_value', table.isDefault),
    safeInteger('metadata_profiles_order', table.sortOrder),
    uniqueIndex('metadata_profiles_default')
      .on(table.entryType)
      .where(sql`${table.isDefault} = 1`),
    index('metadata_profiles_ordered').on(table.entryType, table.sortOrder, table.id),
  ],
)

/** Stores work-specific scan roots and definitions bound to a matching metadata-profile type. */
export const scanConfigs = sqliteTable(
  'scan_configs',
  {
    id: idColumn(),
    name: text('name').notNull(),
    workType: text('work_type', { enum: workTypes }).notNull(),
    rootPath: text('root_path').notNull(),
    metadataProfileId: text('metadata_profile_id').notNull(),
    definition: storedJsonColumn(parseScanDefinitionShape)('definition').notNull(),
    registerExistingContent: integer('register_existing_content', { mode: 'boolean' })
      .notNull()
      .default(false),
    watchEnabled: integer('watch_enabled', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    foreignKey({
      columns: [table.metadataProfileId, table.workType],
      foreignColumns: [metadataProfiles.id, metadataProfiles.entryType],
    }).onDelete('restrict'),
    enumValue('scan_configs_work_type', table.workType, workTypes),
    booleanValue('scan_configs_register_existing', table.registerExistingContent),
    booleanValue('scan_configs_watch_enabled', table.watchEnabled),
    safeInteger('scan_configs_order', table.sortOrder),
    index('scan_configs_ordered').on(table.sortOrder, table.id),
    index('scan_configs_profile').on(table.metadataProfileId),
  ],
)

/**
 * Stores independently ordered showcase sections with complete queries and presentation choices.
 */
export const showcaseSections = sqliteTable(
  'showcase_sections',
  {
    id: idColumn(),
    name: text('name').notNull(),
    query: storedJsonColumn(parseShowcaseQuery)('query').notNull(),
    layout: text('layout', { enum: ['horizontal', 'grid'] }).notNull(),
    itemSize: text('item_size', { enum: ['xs', 'sm', 'md', 'lg', 'xl'] }).notNull(),
    openMode: text('open_mode', { enum: ['page', 'dialog'] }).notNull(),
    limit: integer('limit'),
    isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    enumValue('showcase_sections_layout', table.layout, ['horizontal', 'grid']),
    enumValue('showcase_sections_item_size', table.itemSize, ['xs', 'sm', 'md', 'lg', 'xl']),
    enumValue('showcase_sections_open_mode', table.openMode, ['page', 'dialog']),
    booleanValue('showcase_sections_visible', table.isVisible),
    safeInteger('showcase_sections_limit', table.limit, 1),
    safeInteger('showcase_sections_order', table.sortOrder),
    index('showcase_sections_ordered').on(table.sortOrder, table.id),
  ],
)
