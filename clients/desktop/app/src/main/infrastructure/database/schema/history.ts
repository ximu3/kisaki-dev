/** @fileoverview Keeps generic task history and scanner reports independently readable and removable. */

import { desc } from 'drizzle-orm'
import { primaryKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { parseJsonValue } from '@kisaki3/desktop-contracts/json'
import { parseErrorSummary } from '@kisaki3/desktop-contracts/errors'
import { taskRunStatuses } from '@kisaki3/desktop-contracts/tasks'
import {
  parseScanConfigSnapshot,
  parseScanResult,
  parseScanScope,
} from '@kisaki3/desktop-contracts/scanner'
import { storedJsonColumn } from '../codecs/json'
import { enumValue, idColumn } from './constraints'

/** Creates lifecycle times without inferring a finish for interrupted work. */
function runTimes() {
  return {
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    finishedAt: integer('finished_at'),
  }
}

export const taskRuns = sqliteTable(
  'task_runs',
  {
    id: idColumn(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: taskRunStatuses }).notNull(),
    input: storedJsonColumn(parseJsonValue)('input'),
    result: storedJsonColumn(parseJsonValue)('result'),
    error: storedJsonColumn(parseErrorSummary)('error'),
    ...runTimes(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    enumValue('task_runs_status', table.status, taskRunStatuses),
    index('task_runs_status_created').on(table.status, desc(table.createdAt), table.id),
    index('task_runs_created').on(desc(table.createdAt), table.id),
    index('task_runs_type_created').on(table.type, desc(table.createdAt), table.id),
  ],
)

export const scanRuns = sqliteTable(
  'scan_runs',
  {
    id: idColumn(),
    scanConfigId: text('scan_config_id').notNull(),
    configSnapshot: storedJsonColumn(parseScanConfigSnapshot)('config_snapshot').notNull(),
    scope: storedJsonColumn(parseScanScope)('scope').notNull(),
    description: text('description'),
    status: text('status', {
      enum: ['active', 'completed', 'failed', 'cancelled', 'interrupted'],
    }).notNull(),
    result: storedJsonColumn(parseScanResult)('result'),
    error: storedJsonColumn(parseErrorSummary)('error'),
    ...runTimes(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    enumValue('scan_runs_status', table.status, [
      'active',
      'completed',
      'failed',
      'cancelled',
      'interrupted',
    ]),
    index('scan_runs_config_created').on(table.scanConfigId, desc(table.createdAt), table.id),
    index('scan_runs_status_created').on(table.status, desc(table.createdAt), table.id),
    index('scan_runs_created').on(desc(table.createdAt), table.id),
  ],
)
