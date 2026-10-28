/**
 * @fileoverview Exercises transactions and reopening with the shipped SQLite binding under
 * Electron.
 */

import { expect, test } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDirectory } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

test('the shipped SQLite binding creates, commits, rolls back and reopens under Electron', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-sqlite-'))
  const path = join(directory, 'test.sqlite')
  const options = {
    nativeBinding: join(buildDirectory(hostTarget()), 'resources/native/better-sqlite3.node'),
  }
  let database: Database.Database | undefined
  try {
    database = new Database(path, options)
    database.pragma('journal_mode = WAL')
    database.exec('CREATE TABLE fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE)')
    const insert = database.prepare('INSERT INTO fixture (value) VALUES (?)')

    database.transaction(() => insert.run('已提交'))()
    expect(
      database.transaction(() => {
        insert.run('rolled back')
        insert.run('已提交')
      }),
    ).toThrow()

    database.close()
    database = undefined
    database = new Database(path, options)
    expect(database.prepare('SELECT value FROM fixture').all()).toEqual([{ value: '已提交' }])
  } finally {
    try {
      database?.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
})
