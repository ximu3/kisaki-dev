/** @fileoverview Verifies native forward migrations, failed migration rollback and rejection of unrelated database formats. */

import { expect, onTestFinished, test } from 'vitest'
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { eq, sql } from 'drizzle-orm'
import { DatabaseFormatError, initializeDatabase } from '../../../src/main/infrastructure/database'
import { entries } from '../../../src/main/infrastructure/database/schema'
import { storageOptions } from './fixture'

/** Creates an owned directory and registers cleanup after all test connections have closed. */
async function fixtureDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'kisaki-migrations-'))
  onTestFinished(() => rm(path, { recursive: true, force: true }))
  return path
}

test('runs a forward migration once and retains previous data and user choices after rollback and retry', async () => {
  const directory = await fixtureDirectory()
  const migrations = join(directory, 'migrations')
  const original = storageOptions(directory)
  await cp(original.migrationsDirectory, migrations, { recursive: true })
  const options = { ...original, migrationsDirectory: migrations }
  let storage = initializeDatabase(options)
  onTestFinished(() => storage.close())
  storage.db
    .insert(entries)
    .values({ id: 'saved', type: 'game', name: 'Saved', createdAt: 1, updatedAt: 1 })
    .run()
  storage.db
    .update(storage.preferences)
    .set({ playback: { muted: true, volumePercent: 35 } })
    .where(eq(storage.preferences.id, 1))
    .run()
  storage.close()

  const forward = join(migrations, '20990101000000_forward')
  await mkdir(forward)
  await writeFile(
    join(forward, 'migration.sql'),
    "CREATE TABLE forward_fixture (value TEXT NOT NULL);\n--> statement-breakpoint\nINSERT INTO forward_fixture VALUES ('one');",
  )
  storage = initializeDatabase(options)
  expect(storage.db.all(sql`select * from forward_fixture`)).toEqual([{ value: 'one' }])
  expect(storage.db.select().from(storage.preferences).get()?.playback).toEqual({
    muted: true,
    volumePercent: 35,
  })
  storage.close()
  storage = initializeDatabase(options)
  expect(storage.db.all(sql`select * from forward_fixture`)).toHaveLength(1)
  storage.close()

  const failure = join(migrations, '20990102000000_failure')
  await mkdir(failure)
  await writeFile(
    join(failure, 'migration.sql'),
    "CREATE TABLE rolled_back (value TEXT);\n--> statement-breakpoint\nUPDATE entries SET name = 'Lost';\n--> statement-breakpoint\nINSERT INTO absent_table VALUES (1);",
  )
  expect(() => initializeDatabase(options)).toThrow()
  const inspection = new Database(options.path, { nativeBinding: options.nativeBinding })
  try {
    expect(
      inspection.prepare("select name from sqlite_schema where name = 'rolled_back'").get(),
    ).toBeUndefined()
    expect(inspection.prepare("select name from entries where id = 'saved'").pluck().get()).toBe(
      'Saved',
    )
    expect(inspection.prepare('select count(*) from __drizzle_migrations').pluck().get()).toBe(2)
  } finally {
    inspection.close()
  }
  await writeFile(join(failure, 'migration.sql'), 'CREATE TABLE retried (value TEXT);')
  storage = initializeDatabase(options)
  expect(storage.db.select().from(entries).get()?.name).toBe('Saved')
})

test('can retry an initial failed migration and rejects unrelated or changed migration histories', async () => {
  const directory = await fixtureDirectory()
  const options = storageOptions(directory)
  const migrations = join(directory, 'migrations')
  await cp(options.migrationsDirectory, migrations, { recursive: true })
  const [baseline] = await readdir(migrations)
  const file = join(migrations, baseline!, 'migration.sql')
  const original = await readFile(file, 'utf8')
  await writeFile(
    file,
    `${original}\n--> statement-breakpoint\nINSERT INTO absent_table VALUES (1);`,
  )
  const isolated = { ...options, migrationsDirectory: migrations }
  expect(() => initializeDatabase(isolated)).toThrow()
  await writeFile(file, original)
  const storage = initializeDatabase(isolated)
  storage.close()

  await writeFile(file, `${original}\n-- an altered published migration\n`)
  expect(() => initializeDatabase(isolated)).toThrow(DatabaseFormatError)
  await copyFile(join(options.migrationsDirectory, baseline!, 'migration.sql'), file)
  const reopened = initializeDatabase(isolated)
  reopened.close()

  const unrelatedPath = join(directory, 'unrelated.sqlite')
  const unrelated = new Database(unrelatedPath, { nativeBinding: options.nativeBinding })
  unrelated.exec("create table user_data (value text); insert into user_data values ('Keep');")
  unrelated.close()
  const bytes = await readFile(unrelatedPath)
  expect(() => initializeDatabase({ ...options, path: unrelatedPath })).toThrow(DatabaseFormatError)
  expect(await readFile(unrelatedPath)).toEqual(bytes)
})
