import { expect, onTestFinished, test } from 'vite-plus/test'
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { eq, sql } from 'drizzle-orm'
import { DatabaseFormatError, initializeDatabase } from '../../../src/main/infrastructure/database'
import { verifyExistingLibrary } from '../../../src/main/infrastructure/database/initialize'
import { entries } from '../../../src/main/infrastructure/database/schema'
import { storageOptions } from './sample'

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

test('can retry an initial failed migration and rejects changed migration histories', async () => {
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
})

test('preserves foreign SQLite schemas and application metadata byte for byte', async () => {
  const directory = await fixtureDirectory()
  const options = storageOptions(directory)
  for (const [name, schema] of [
    ['view', "create view shelf_titles as select 'Keep' as title"],
    ['version', 'pragma user_version = 1'],
    ['table', "create table sqlite3_notes (value text); insert into sqlite3_notes values ('Keep')"],
    [
      'ledger',
      'create table __drizzle_migrations (id integer primary key, hash text not null, created_at numeric, name text, applied_at text)',
    ],
  ] as const) {
    const path = join(directory, name + '.sqlite')
    const unrelated = new Database(path, { nativeBinding: options.nativeBinding })
    try {
      unrelated.exec(schema)
    } finally {
      unrelated.close()
    }

    const before = await readFile(path)
    expect(() => initializeDatabase({ ...options, path })).toThrow(DatabaseFormatError)
    expect(await readFile(path)).toEqual(before)
  }
})

test('inspecting a candidate does not claim an empty database as a library', async () => {
  const options = storageOptions(await fixtureDirectory())
  const empty = new Database(options.path, { nativeBinding: options.nativeBinding })
  empty.close()
  const before = await readFile(options.path)

  expect(() => verifyExistingLibrary(options.path, options)).toThrow(DatabaseFormatError)
  expect(await readFile(options.path)).toEqual(before)

  initializeDatabase(options).close()
  expect(() => verifyExistingLibrary(options.path, options)).not.toThrow()
})
