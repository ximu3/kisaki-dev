/** @fileoverview Stores manual or dynamic collections, reusable tags and their actual membership sides. */

import { sql } from 'drizzle-orm'
import {
  blob,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'
import { parseDynamicRules } from '@kisaki3/desktop-contracts/library'
import { storedJsonColumn } from '../codecs/json'
import { attachments } from './attachments'
import { entries } from './catalog'
import { booleanValue, nonempty, idColumn, safeInteger, timestamps } from './constraints'

export const collections = sqliteTable(
  'collections',
  {
    id: idColumn(),
    name: text('name').notNull(),
    description: text('description'),
    primaryImageId: text('primary_image_id').references(() => attachments.id, {
      onDelete: 'restrict',
    }),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    membershipMode: text('membership_mode', { enum: ['manual', 'dynamic'] })
      .notNull()
      .default('manual'),
    dynamicRules: storedJsonColumn(parseDynamicRules)('dynamic_rules'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique('collections_id_mode').on(table.id, table.membershipMode),
    nonempty('collections_name', table.name),
    booleanValue('collections_nsfw', table.isNsfw),
    check(
      'collections_rules',
      sql`(${table.membershipMode} = 'manual' and ${table.dynamicRules} is null) or (${table.membershipMode} = 'dynamic' and ${table.dynamicRules} is not null)`,
    ),
    safeInteger('collections_order', table.sortOrder),
    index('collections_ordered').on(table.sortOrder, table.id),
    index('collections_primary_image').on(table.primaryImageId),
  ],
)

export const collectionMembers = sqliteTable(
  'collection_members',
  {
    collectionId: text('collection_id').notNull(),
    membershipMode: text('membership_mode').generatedAlwaysAs(sql`'manual'`),
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    note: text('note'),
    orderInCollection: integer('order_in_collection').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.entryId] }),
    foreignKey({
      columns: [table.collectionId, table.membershipMode],
      foreignColumns: [collections.id, collections.membershipMode],
    }).onDelete('cascade'),
    safeInteger('collection_members_order', table.orderInCollection),
    index('collection_members_ordered').on(
      table.collectionId,
      table.orderInCollection,
      table.entryId,
    ),
    index('collection_members_entry').on(table.entryId, table.collectionId),
  ],
)

export const tags = sqliteTable(
  'tags',
  {
    id: idColumn(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull().unique(),
    description: text('description'),
    isNsfw: integer('is_nsfw', { mode: 'boolean' }).notNull().default(false),
    ...timestamps(),
    nameOrderKey: blob('name_order_key', { mode: 'buffer' }).generatedAlwaysAs(
      sql`kisaki_name_key_v1("name")`,
      { mode: 'stored' },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    nonempty('tags_name', table.name),
    nonempty('tags_name_key', table.nameKey),
    booleanValue('tags_nsfw', table.isNsfw),
    index('tags_name_order').on(table.nameOrderKey, table.id),
  ],
)

export const entryTags = sqliteTable(
  'entry_tags',
  {
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    note: text('note'),
    isSpoiler: integer('is_spoiler', { mode: 'boolean' }).notNull().default(false),
    orderInEntry: integer('order_in_entry').notNull().default(0),
    orderInTag: integer('order_in_tag').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.tagId] }),
    booleanValue('entry_tags_spoiler', table.isSpoiler),
    safeInteger('entry_tags_entry_order', table.orderInEntry),
    safeInteger('entry_tags_tag_order', table.orderInTag),
    index('entry_tags_entry').on(table.entryId, table.orderInEntry, table.tagId),
    index('entry_tags_tag').on(table.tagId, table.orderInTag, table.entryId),
  ],
)
