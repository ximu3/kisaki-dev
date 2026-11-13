/** @fileoverview Stores immutable backup provenance and recovery indexes independently from task history. */

import { desc, sql } from 'drizzle-orm'
import { primaryKey, check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { attachments } from './attachments'
import { games } from './catalog'
import { gameLaunchConfigs } from './holdings'
import { booleanValue, enumValue, idColumn, safeInteger } from './constraints'

export const gameSaveBackups = sqliteTable(
  'game_save_backups',
  {
    id: idColumn(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.entryId, { onDelete: 'cascade' }),
    sourceConfigId: text('source_config_id').references(() => gameLaunchConfigs.id, {
      onDelete: 'set null',
    }),
    sourceConfigName: text('source_config_name').notNull(),
    sourcePath: text('source_path').notNull(),
    sourceKind: text('source_kind', { enum: ['file', 'directory'] }).notNull(),
    reason: text('reason', { enum: ['manual', 'automatic', 'beforeRestore'] }).notNull(),
    archiveAttachmentId: text('archive_attachment_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'restrict' }),
    treeDigest: text('tree_digest').notNull(),
    unpackedSizeBytes: integer('unpacked_size_bytes').notNull(),
    note: text('note'),
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    enumValue('game_save_backups_kind', table.sourceKind, ['file', 'directory']),
    enumValue('game_save_backups_reason', table.reason, ['manual', 'automatic', 'beforeRestore']),
    booleanValue('game_save_backups_locked', table.isLocked),
    safeInteger('game_save_backups_size', table.unpackedSizeBytes),
    check(
      'game_save_backups_digest',
      sql`length(${table.treeDigest}) = 64 and ${table.treeDigest} not glob '*[^0-9a-f]*'`,
    ),
    index('game_save_backups_game').on(table.gameId, desc(table.createdAt), table.id),
    index('game_save_backups_source').on(
      table.sourceConfigId,
      table.sourcePath,
      table.isLocked,
      desc(table.createdAt),
    ),
    index('game_save_backups_attachment').on(table.archiveAttachmentId),
  ],
)

export const gameBackupRecoveries = sqliteTable(
  'game_backup_recoveries',
  {
    id: idColumn(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.entryId, { onDelete: 'restrict' }),
    backupId: text('backup_id')
      .notNull()
      .references(() => gameSaveBackups.id, { onDelete: 'restrict' }),
    protectionBackupId: text('protection_backup_id').references(() => gameSaveBackups.id, {
      onDelete: 'restrict',
    }),
    targetPath: text('target_path').notNull(),
    targetKind: text('target_kind', { enum: ['file', 'directory'] }).notNull(),
    workspacePath: text('workspace_path').notNull().unique(),
    manifestSha256: text('manifest_sha256').notNull(),
    createdAt: integer('created_at').notNull(),
    resolution: text('resolution', { enum: ['restored', 'rolledBack', 'keptCurrent'] }),
    resolvedAt: integer('resolved_at'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    enumValue('game_backup_recoveries_kind', table.targetKind, ['file', 'directory']),
    enumValue('game_backup_recoveries_resolution', table.resolution, [
      'restored',
      'rolledBack',
      'keptCurrent',
    ]),
    check(
      'game_backup_recoveries_resolution_time',
      sql`(${table.resolution} is null) = (${table.resolvedAt} is null)`,
    ),
    check(
      'game_backup_recoveries_digest',
      sql`length(${table.manifestSha256}) = 64 and ${table.manifestSha256} not glob '*[^0-9a-f]*'`,
    ),
    index('game_backup_recoveries_game').on(
      table.gameId,
      table.resolution,
      desc(table.createdAt),
      table.id,
    ),
    index('game_backup_recoveries_resolution_order').on(
      table.resolution,
      desc(table.createdAt),
      table.id,
    ),
    index('game_backup_recoveries_backup').on(table.backupId),
    index('game_backup_recoveries_protection').on(table.protectionBackupId),
  ],
)
