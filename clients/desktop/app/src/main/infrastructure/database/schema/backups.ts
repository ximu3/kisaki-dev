import { desc, sql } from 'drizzle-orm'
import {
  primaryKey,
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'
import { attachments } from './attachments/metadata'
import { games } from './catalog'
import { gameLaunchConfigs } from './holdings'
import {
  booleanValue,
  enumValue,
  idColumn,
  retainedWorkReference,
  safeInteger,
  workForeignKey,
} from './constraints'

const sourceKinds = ['file', 'directory'] as const
const backupReasons = ['manual', 'automatic', 'beforeRestore'] as const
const recoveryResolutions = ['restored', 'rolledBack', 'keptCurrent'] as const

export const gameSaveBackups = sqliteTable(
  'game_save_backups',
  {
    id: idColumn(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.entryId, { onDelete: 'cascade' }),
    sourceConfigId: text('source_config_id'),
    sourceConfigName: text('source_config_name').notNull(),
    sourcePath: text('source_path').notNull(),
    sourceKind: text('source_kind', { enum: sourceKinds }).notNull(),
    reason: text('reason', { enum: backupReasons }).notNull(),
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
    unique('game_save_backups_id_work').on(table.id, table.gameId),
    ...retainedWorkReference(
      table.sourceConfigId,
      table.gameId,
      gameLaunchConfigs.id,
      gameLaunchConfigs.gameId,
    ),
    enumValue('game_save_backups_kind', table.sourceKind, sourceKinds),
    enumValue('game_save_backups_reason', table.reason, backupReasons),
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
    backupId: idColumn('backup_id'),
    protectionBackupId: text('protection_backup_id'),
    targetPath: text('target_path').notNull(),
    targetKind: text('target_kind', { enum: sourceKinds }).notNull(),
    workspacePath: text('workspace_path').notNull().unique(),
    manifestSha256: text('manifest_sha256'),
    createdAt: integer('created_at').notNull(),
    resolution: text('resolution', { enum: recoveryResolutions }),
    resolvedAt: integer('resolved_at'),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    workForeignKey(
      table.backupId,
      table.gameId,
      gameSaveBackups.id,
      gameSaveBackups.gameId,
    ).onDelete('restrict'),
    workForeignKey(
      table.protectionBackupId,
      table.gameId,
      gameSaveBackups.id,
      gameSaveBackups.gameId,
    ).onDelete('restrict'),
    enumValue('game_backup_recoveries_kind', table.targetKind, sourceKinds),
    enumValue('game_backup_recoveries_resolution', table.resolution, recoveryResolutions),
    check(
      'game_backup_recoveries_resolution_time',
      sql`(${table.resolution} is null) = (${table.resolvedAt} is null)`,
    ),
    check(
      'game_backup_recoveries_digest',
      sql`${table.manifestSha256} is null or (length(${table.manifestSha256}) = 64 and ${table.manifestSha256} not glob '*[^0-9a-f]*')`,
    ),
    check(
      'game_backup_recoveries_published',
      sql`${table.resolution} not in ('restored', 'rolledBack') or ${table.manifestSha256} is not null`,
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
