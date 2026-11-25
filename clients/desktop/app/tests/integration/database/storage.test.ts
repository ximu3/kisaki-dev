import { afterEach, beforeEach, expect, test } from 'vite-plus/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import * as tables from '../../../src/main/infrastructure/database/schema'
import { seedStorage, storageOptions } from './sample'

let directory: string

let storage: ReturnType<typeof initializeDatabase>

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
  const animeDefaults = db.get<{ value: string }>(
    sql`select json_extract(usage, '$.anime') as value from preferences`,
  )!.value
  expect(JSON.parse(animeDefaults)).toEqual({
    audioLanguages: [],
    subtitleLanguages: [],
    subtitlesEnabled: true,
    playbackSpeed: 1,
    subtitleScale: 1,
    autoAdvance: false,
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
    storage.transaction((transaction) => {
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
    animeId: 'anime',
    fileId: null,
    episodeId: 'episode',
    durationMs: 500,
    contextNames: { status: 'ready', value: { fileName: '映像.mkv', partName: '12.5' } },
  })
  expect(storage.db.select().from(tables.animeAnnotations).get()).toMatchObject({
    animeId: 'anime',
    fileId: null,
    content: '保存内容',
    location: { status: 'ready', value: { type: 'position', positionSeconds: 2.5 } },
  })
  storage.db.delete(tables.animeEpisodes).where(eq(tables.animeEpisodes.id, 'episode')).run()
  expect(storage.db.select().from(tables.animeWatchActivity).get()).toMatchObject({
    animeId: 'anime',
    fileId: null,
    episodeId: null,
    durationMs: 500,
    contextNames: { status: 'ready', value: { fileName: '映像.mkv', partName: '12.5' } },
  })
  storage.db.delete(tables.gameLaunchConfigs).where(eq(tables.gameLaunchConfigs.id, 'launch')).run()
  expect(storage.db.select().from(tables.gameSaveBackups).get()).toMatchObject({
    gameId: 'game',
    sourceConfigId: null,
    sourceConfigName: '設定',
    archiveAttachmentId: 'attachment',
  })
})

test('rejects relationships across valid but different works and rejects non-work completion subjects', () => {
  const connection = storage.db.$client
  connection.exec(`
    insert into entries(id,type,name,created_at,updated_at) values
      ('other-anime','anime','Other anime',1,1),
      ('other-comic','comic','Other comic',1,1),
      ('other-game','game','Other game',1,1);
    insert into animes(entry_id) values ('other-anime');
    insert into comics(entry_id) values ('other-comic');
    insert into games(entry_id) values ('other-game');
    insert into anime_episodes(id,anime_id,created_at,updated_at)
      values ('other-episode','other-anime',1,1);
    insert into anime_files(id,anime_id,path,created_at,updated_at)
      values ('other-video','other-anime','other.mkv',1,1);
    insert into comic_chapters(id,comic_id,created_at,updated_at)
      values ('other-chapter','other-comic',1,1);
  `)

  for (const statement of [
    "insert into anime_file_episodes(anime_id,file_id,episode_id) values ('anime','video','other-episode')",
    "insert into anime_file_episodes(anime_id,file_id,episode_id) values ('other-anime','video','other-episode')",
    "insert into comic_volume_chapters(comic_id,volume_id,chapter_id) values ('comic','volume','other-chapter')",
    "update anime_watch_activity set episode_id = 'other-episode' where id = 'watched'",
    "update anime_annotations set file_id = 'other-video' where id = 'annotation'",
    "update game_save_backups set game_id = 'other-game' where id = 'backup'",
    `insert into game_backup_recoveries (id,game_id,backup_id,target_path,target_kind,workspace_path,manifest_sha256,created_at)
      values ('recovery','other-game','backup','saves','directory','recoveries',printf('%064d',0),1)`,
    "insert into work_completion_records(id,work_id,work_type,note,created_at,updated_at) values ('wrong-subject','person','game','Finished',1,1)",
    "insert into work_completion_records(id,work_id,work_type,note,created_at,updated_at) values ('wrong-type','anime','comic','Finished',1,1)",
  ]) {
    expect(() => connection.prepare(statement).run()).toThrow(
      expect.objectContaining({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }),
    )
  }
  expect(() =>
    connection.exec(
      "insert into work_completion_records(id,work_id,work_type,note,created_at,updated_at) values ('person-completion','person','person','Finished',1,1)",
    ),
  ).toThrow(expect.objectContaining({ code: 'SQLITE_CONSTRAINT_CHECK' }))
  expect(connection.pragma('foreign_key_check')).toEqual([])
})

test('the native transaction rolls back a thenable even when queries use the Drizzle mapping', () => {
  expect(() =>
    // @ts-expect-error A worker transaction operation must return synchronously.
    storage.transaction((db) => {
      db.update(tables.entries)
        .set({ name: 'not committed' })
        .where(eq(tables.entries.id, 'game'))
        .run()
      return Promise.resolve()
    }, 'immediate'),
  ).toThrow('Transaction function cannot return a promise')
  expect(storage.db.$client.inTransaction).toBe(false)
  expect(
    storage.db.select().from(tables.entries).where(eq(tables.entries.id, 'game')).get()?.name,
  ).toBe('資料 game')
})

test('reopens a recovery registered before manifest publication and checks the published digest', () => {
  const recoveries = tables.gameBackupRecoveries
  storage.db
    .insert(recoveries)
    .values({
      id: 'recovery',
      gameId: 'game',
      backupId: 'backup',
      targetPath: join(directory, 'save'),
      targetKind: 'directory',
      workspacePath: join(directory, 'recovery'),
      createdAt: 1,
    })
    .run()
  storage.close()
  storage = initializeDatabase(storageOptions(directory))
  const { db } = storage
  expect(db.select().from(recoveries).get()).toMatchObject({
    manifestSha256: null,
    resolution: null,
  })
  expect(() => db.update(recoveries).set({ manifestSha256: 'invalid' }).run()).toThrow()
  expect(() => db.update(recoveries).set({ resolution: 'restored', resolvedAt: 2 }).run()).toThrow()
  const digest = 'a'.repeat(64)
  db.update(recoveries).set({ manifestSha256: digest }).run()
  db.update(recoveries).set({ resolution: 'restored', resolvedAt: 2 }).run()
  expect(db.select().from(recoveries).get()).toMatchObject({
    manifestSha256: digest,
    resolution: 'restored',
    resolvedAt: 2,
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
  const order = (db: typeof storage, ids: string[]) =>
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
