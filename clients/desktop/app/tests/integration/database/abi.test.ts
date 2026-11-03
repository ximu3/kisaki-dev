/**
 * @fileoverview Exercises persistent reads and writes with the shipped SQLite binding under Electron.
 */

import { expect, onTestFinished, test } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

test('the shipped SQLite binding writes and reopens a persistent database under Electron', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-sqlite-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'test.sqlite')
  const options = {
    nativeBinding: join(appRoot, 'out', 'resources', hostTarget(), 'native/better-sqlite3.node'),
  }
  let database: Database.Database | undefined
  onTestFinished(() => {
    database?.close()
  })

  database = new Database(path, options)
  database.pragma('journal_mode = WAL')
  database.exec('CREATE TABLE fixture (value TEXT NOT NULL)')
  database.prepare('INSERT INTO fixture (value) VALUES (?)').run('已保存')

  database.close()
  database = undefined

  database = new Database(path, options)

  expect(database.prepare('SELECT value FROM fixture').all()).toEqual([{ value: '已保存' }])
})
