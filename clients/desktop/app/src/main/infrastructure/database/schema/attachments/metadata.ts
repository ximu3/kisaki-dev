/** @fileoverview Declares the immutable metadata and identity of each registered attachment. */

import { sql } from 'drizzle-orm'
import { primaryKey, check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { idColumn, safeInteger, nonempty } from '../constraints'

/** Stores immutable attachment identities, byte digests and optional image dimensions. */
export const attachments = sqliteTable(
  'attachments',
  {
    id: idColumn(),
    mediaType: text('media_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    nonempty('attachments_id', table.id),
    check(
      'attachments_sha256',
      sql`length(${table.sha256}) = 64 and ${table.sha256} not glob '*[^0-9a-f]*'`,
    ),
    safeInteger('attachments_size', table.byteSize),
    safeInteger('attachments_width', table.width, 1),
    safeInteger('attachments_height', table.height, 1),
    check('attachments_dimensions', sql`(${table.width} is null) = (${table.height} is null)`),
    safeInteger('attachments_created', table.createdAt, Number.MIN_SAFE_INTEGER),
  ],
)
