/** @fileoverview Verifies formal schema constraints, codecs, transactions and durable reopening on the actual Electron driver. */

import { afterEach, beforeEach, expect, test } from 'vite-plus/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import type { Storage } from '../../../src/main/infrastructure/database'
import * as tables from '../../../src/main/infrastructure/database/schema'
import { seedStorage, storageOptions } from './sample'

/** Disposable database directory owned by the current storage case. */
let directory: string

/** Current real connection, replaced during reopen checks and closed before directory cleanup. */
let storage: Storage

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-storage-'))
  storage = initializeDatabase(storageOptions(directory))
  seedStorage(storage, directory)
})

afterEach(async () => {
  storage.close()
  await rm(directory, { recursive: true, force: true })
})

test('persists nonempty catalog, resource, history and settings facts and enforces relational constraints', () => {
  const { db } = storage
  expect(db.select().from(tables.entries).all()).toHaveLength(7)
  expect(db.select().from(tables.onboardingState).get()?.state).toEqual({
    status: 'ready',
    value: {
      firstPresentedAt: null,
      firstCompletedAt: null,
      lastPresentedVersion: null,
      handled: {},
    },
  })
  expect(db.select().from(storage.preferences).get()?.general.uiTranslation).toEqual({
    status: 'ready',
    value: { type: 'builtin', id: 'en' },
  })
  expect(db.get<{ foreign_keys: number }>(sql`pragma foreign_keys`)?.foreign_keys).toBe(1)
  expect(db.get<{ synchronous: number }>(sql`pragma synchronous`)?.synchronous).toBe(2)
  expect(db.get<{ journal_mode: string }>(sql`pragma journal_mode`)?.journal_mode).toBe('wal')

  expect(() => db.insert(tables.animes).values({ entryId: 'game' }).run()).toThrow()
  expect(() =>
    db.insert(tables.entryEvaluations).values({ entryId: 'person', rating: 101 }).run(),
  ).toThrow()
  expect(() =>
    db
      .insert(tables.entryExternalIdentities)
      .values({ source: 'fixture-source', sourceId: 'Exact/Ａ', ownerId: 'anime' })
      .run(),
  ).toThrow()
  expect(() =>
    db
      .insert(tables.workPersonLinks)
      .values({
        id: 'voice',
        workId: 'game',
        workType: 'game',
        personId: 'person',
        role: 'director',
      })
      .run(),
  ).toThrow()
  expect(() =>
    db
      .insert(tables.workPersonLinks)
      .values({
        id: 'bad-cast',
        workId: 'game',
        workType: 'game',
        personId: 'person',
        characterId: 'character',
        role: 'voiceActor',
        orderInCharacter: 0,
      })
      .run(),
  ).toThrow()
  expect(() =>
    db.delete(tables.attachments).where(eq(tables.attachments.id, 'attachment')).run(),
  ).toThrow()
  expect(() =>
    db.transaction((transaction) => {
      transaction
        .update(tables.entries)
        .set({ name: 'not committed' })
        .where(eq(tables.entries.id, 'game'))
        .run()
      transaction
        .insert(tables.collectionMembers)
        .values({ collectionId: 'collection', entryId: 'missing' })
        .run()
    }),
  ).toThrow()
  expect(db.select().from(tables.entries).where(eq(tables.entries.id, 'game')).get()?.name).toBe(
    '資料 game',
  )

  storage.close()
  storage = initializeDatabase(storageOptions(directory))
  expect(storage.db.select().from(tables.entryEvaluations).get()?.rating).toBe(85)
  expect(storage.db.select().from(tables.workCompletionRecords).get()?.completedDate).toEqual({
    year: 0,
    month: 2,
    day: 29,
  })
  expect(storage.db.select().from(tables.extensionStorage).get()?.value).toEqual({
    status: 'ready',
    value: { enabled: true, selected: ['保留'] },
  })
  expect(storage.db.select().from(tables.extensionSecrets).get()?.encryptedValue).toEqual(
    Buffer.from([1, 2, 3]),
  )
  expect(storage.db.select().from(tables.gameSaveBackups).get()?.sourceConfigName).toBe('設定')
  expect(
    storage.db.query.entries
      .findFirst({
        where: { id: 'anime' },
        with: { anime: { with: { episodes: true, files: true } } },
      })
      .sync()?.anime?.files[0]?.availability.status,
  ).toBe('ready')

  storage.db.delete(tables.animeFiles).where(eq(tables.animeFiles.id, 'video')).run()
  expect(storage.db.select().from(tables.animeWatchActivity).get()).toMatchObject({
    fileId: null,
    durationMs: 500,
    contextNames: { status: 'ready', value: { fileName: '映像.mkv', partName: '12.5' } },
  })
  expect(storage.db.select().from(tables.animeAnnotations).get()).toMatchObject({
    fileId: null,
    content: '保存内容',
    location: { status: 'ready', value: { type: 'position', positionSeconds: 2.5 } },
  })
})

test('isolates corrupt fields on reads, rejects invalid writes and leaves untouched raw values intact', () => {
  const { db, preferences } = storage
  const aliases = '["first",42,"last"]'
  db.run(sql`update entries set aliases = ${aliases} where id = 'game'`)
  db.run(
    sql`update games set release_date = '{"year":2023,"month":2,"day":29}' where entry_id = 'game'`,
  )
  db.run(sql`update game_launch_configs set definition = '{}' where id = 'launch'`)
  db.run(
    sql`update preferences set general = '{"uiTranslation":{"type":"wrong"},"closeMainWindow":"quit"}', playback = '{"volumePercent":"bad","muted":true}', network = '{"mode":"manual","endpoint":null,"bypassRules":""}' where id = 1`,
  )

  expect(
    db.select().from(tables.entries).where(eq(tables.entries.id, 'game')).get()?.aliases,
  ).toEqual(['first', 'last'])
  expect(
    db.query.entries.findFirst({ where: { id: 'game' }, with: { game: true } }).sync(),
  ).toMatchObject({ aliases: ['first', 'last'], game: { releaseDate: null } })
  expect(db.select().from(tables.gameLaunchConfigs).get()).toMatchObject({
    name: '設定',
    definition: { status: 'invalid' },
  })
  expect(db.select().from(preferences).get()).toMatchObject({
    general: { closeMainWindow: 'quit', uiTranslation: { status: 'invalid' } },
    playback: { volumePercent: 100, muted: true },
    network: { status: 'invalid' },
    library: { showNsfw: true },
  })
  expect(() =>
    db
      .update(tables.games)
      .set({ releaseDate: { year: 2023, month: 2, day: 29 } })
      .where(eq(tables.games.entryId, 'game'))
      .run(),
  ).toThrow()
  expect(() =>
    db
      .update(tables.entries)
      .set({ aliases: ['valid', 42] as unknown as string[] })
      .where(eq(tables.entries.id, 'game'))
      .run(),
  ).toThrow()

  db.update(tables.entries)
    .set({ description: 'other edit' })
    .where(eq(tables.entries.id, 'game'))
    .run()
  expect(
    db.get<{ aliases: string }>(sql`select aliases from entries where id = 'game'`)?.aliases,
  ).toBe(aliases)
  expect(
    db.get<{ general: string }>(sql`select general from preferences where id = 1`)?.general,
  ).toBe('{"uiTranslation":{"type":"wrong"},"closeMainWindow":"quit"}')
})

test('adopts the effective software locale with its indexes and rebuilds an obsolete ICU revision on reopen', () => {
  const connection = storage.db.$client
  const samples = [
    ['x', 'z'],
    ['y', 'ä'],
    ['n2', 'Item 2'],
    ['n10', 'Item 10'],
    ['a', '八'],
    ['b', '阿'],
  ]
  for (const [id, name] of samples) {
    connection
      .prepare("insert into entries(id,type,name,created_at,updated_at) values (?,'game',?,1,1)")
      .run(id, name)
  }
  /** Reads the controlled names through their actual SQLite index and stable identity tie-break. */
  const order = (db: Storage, ids: string[]) =>
    db.db.$client
      .prepare(
        `select id from entries indexed by entries_name where id in (${ids.map(() => '?').join(',')}) order by name collate kisaki_name,id`,
      )
      .pluck()
      .all(...ids)
  storage.adoptLocale('sv')
  expect(order(storage, ['x', 'y'])).toEqual(['x', 'y'])
  storage.adoptLocale('de')
  expect(order(storage, ['x', 'y'])).toEqual(['y', 'x'])
  storage.adoptLocale('zh-Hans-CN')
  expect(order(storage, ['a', 'b'])).toEqual(['b', 'a'])
  expect(order(storage, ['n2', 'n10'])).toEqual(['n2', 'n10'])

  connection.prepare('select kisaki_set_name_locale(?)').get('sv')
  connection.exec("reindex kisaki_name; update name_order_state set revision='old'")
  storage.close()
  storage = initializeDatabase(storageOptions(directory))
  expect(order(storage, ['a', 'b'])).toEqual(['b', 'a'])
  const state = storage.db.select().from(tables.nameOrderState).get()!
  expect(state.locale).toBe('zh-Hans-CN')
  expect(state.revision).not.toBe('old')

  storage.close()
  storage = initializeDatabase(storageOptions(directory))
  storage.adoptLocale('zh-Hans-CN')
  expect(storage.db.$client.prepare('select total_changes()').pluck().get()).toBe(0)
})
