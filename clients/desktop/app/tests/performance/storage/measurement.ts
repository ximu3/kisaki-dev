/** @fileoverview Measures validated storage queries on the complete workload in an Electron database worker. */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { cpus, release, totalmem } from 'node:os'
import { join } from 'node:path'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { setImmediate } from 'node:timers/promises'
import { asc } from 'drizzle-orm'
import type Database from 'better-sqlite3'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { entries as entryTable } from '../../../src/main/infrastructure/database/schema'
import { getPreferenceDefaults } from '../../../src/main/features/preferences/defaults'
import { fixtureId, prepareWorkload, workload } from './workload'
import type { FixtureEntry } from './workload'
import manifest from '../../../package.json' with { type: 'json' }

/** One already validated statement, with complete SQL and plan retained as reproducible evidence. */
interface QueryMeasurement {
  readonly name: string
  readonly statement: string
  readonly parameters: readonly (string | number | Buffer)[]
  readonly expectedRows: number
  readonly plan: unknown
  readonly firstReadMs: number
  readonly samplesMs: readonly number[]
  readonly medianMs: number
  readonly p95Ms: number
  readonly maxMs: number
}

/** A measured synchronous operation and its separately executed result assertion. */
interface QueryCase {
  readonly name: string
  readonly statement: string
  readonly parameters: readonly (string | number | Buffer)[]
  readonly expectedRows: number

  /** Executes the complete synchronous operation without result verification overhead. */
  run(): unknown

  /** Checks independently calculated results before sampling begins. */
  verify(value: unknown): void
}

/** Independent English comparator for this fixed workload's names, using natural number order. */
const fixtureCollator = new Intl.Collator('en', {
  usage: 'sort',
  numeric: true,
  sensitivity: 'accent',
})

/** Applies the fixture comparator and the same stable identity tie-break to expected results. */
function compareEntries(left: FixtureEntry, right: FixtureEntry): number {
  return (
    fixtureCollator.compare(left.name, right.name) ||
    (left.id < right.id ? -1 : Number(left.id > right.id))
  )
}

/** Creates list, total and locate statements from one predicate and independently calculated members. */
function resultSet(
  connection: Database.Database,
  name: string,
  where: string,
  expected: FixtureEntry[],
): QueryCase[] {
  expected.sort(compareEntries)
  const offset = Math.max(0, expected.length - 200)
  const listSql = `select e.id from entries e where ${where} order by e.effective_sort_name,e.id limit 200 offset ${offset}`
  const countSql = `select count(*) as total from entries e where ${where}`
  const target = expected[Math.floor(expected.length * 0.8)]!
  const locateSql = `select count(*) as position from entries e where (${where}) and (e.effective_sort_name,e.id) < (?,?)`
  const list = connection.prepare(listSql)
  const count = connection.prepare(countSql)
  const locate = connection.prepare(locateSql)
  return [
    {
      name: `${name}.list`,
      statement: listSql,
      parameters: [],
      expectedRows: Math.min(200, expected.length),
      /** Reads the requested distant interval in its stable order. */
      run: () => list.all(),
      /** Compares every returned identity against the fixture's independent interval. */
      verify: (value) =>
        assert.deepEqual(
          value,
          expected.slice(offset, offset + 200).map((entry) => ({ id: entry.id })),
        ),
    },
    {
      name: `${name}.total`,
      statement: countSql,
      parameters: [],
      expectedRows: 1,
      /** Counts the same complete predicate used by list and locate. */
      run: () => count.get(),
      /** Checks the complete membership count. */
      verify: (value) => assert.deepEqual(value, { total: expected.length }),
    },
    {
      name: `${name}.locate`,
      statement: locateSql,
      parameters: [target.name, target.id],
      expectedRows: 1,
      /** Locates the fixed target under the same predicate and ordering. */
      run: () => locate.get(target.name, target.id),
      /** Confirms the target's independently computed zero-based position. */
      verify: (value) => assert.deepEqual(value, { position: Math.floor(expected.length * 0.8) }),
    },
  ]
}

/** Builds and measures the fixed fixture; every connection is closed before returning a report. */
export async function measureStorage(profile: string, resources: string) {
  assert(
    process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux',
  )
  const directory = join(profile, 'storage-performance')
  await mkdir(directory)
  const options = {
    path: join(directory, 'library.sqlite'),
    nativeBinding: join(resources, 'native/better-sqlite3.node'),
    collationExtension: join(resources, 'native/kisaki-native.node'),
    migrationsDirectory: join(resources, 'drizzle'),
    defaults: getPreferenceDefaults(process.platform, []),
  }
  let storage = initializeDatabase(options)
  const loop = monitorEventLoopDelay({ resolution: 1 })
  try {
    storage.adoptLocale('en')
    const prepared = await prepareWorkload(storage, directory)
    storage.close()
    storage = initializeDatabase(options)
    storage.adoptLocale('en')
    const localeSamples: { locale: string; elapsedMs: number }[] = []
    for (const locale of ['zh-Hans-CN', 'sv', 'en', 'en'] as const) {
      const start = performance.now()
      storage.adoptLocale(locale)
      localeSamples.push({ locale, elapsedMs: performance.now() - start })
    }
    const connection = storage.db.$client
    const entries = prepared.entries
    const observedCounts: Record<string, number> = {}
    for (const table of [
      'entries',
      ...Object.keys(workload.parts),
      ...Object.keys(workload.relations),
      ...Object.keys(workload.files),
      'game_play_activity',
      'anime_watch_activity',
      'comic_reading_activity',
      'novel_reading_activity',
      'collections',
    ]) {
      observedCounts[table] = connection
        .prepare(`select count(*) from ${table}`)
        .pluck()
        .get() as number
    }
    assert.equal(observedCounts.entries, 50000)
    for (const [table, count] of [
      ...Object.entries(workload.parts),
      ...Object.entries(workload.relations),
      ...Object.entries(workload.files),
    ]) {
      assert.equal(observedCounts[table], count)
    }
    assert.equal(
      [
        'game_play_activity',
        'anime_watch_activity',
        'comic_reading_activity',
        'novel_reading_activity',
      ].reduce((sum, table) => sum + observedCounts[table]!, 0),
      workload.activities,
    )
    assert.equal(observedCounts.collections, 120)
    assert.deepEqual(connection.pragma('foreign_key_check'), [])

    const dynamicTags = Array.from(
      { length: 100 },
      (_, index) => `'${fixtureId('tag', index)}'`,
    ).join(',')
    // Probe each entry's own tag list once, rather than seeking every selected tag for every entry.
    const matchesDynamic = `exists (select 1 from entry_tags t indexed by entry_tags_entry where t.entry_id=e.id and t.tag_id in (${dynamicTags}))`
    /** Evaluates the fixture's hundred tag rules independently of SQL. */
    const isDynamic = (entry: FixtureEntry) =>
      entry.ordinal % 200 < 100 || (entry.ordinal + 73) % 200 < 100
    const queries: QueryCase[] = [
      ...resultSet(
        connection,
        'mixed-rated',
        "e.type in ('anime','comic','novel') and exists (select 1 from entry_evaluations r where r.entry_id = e.id and r.rating >= 70)",
        entries.filter(
          (entry) => ['anime', 'comic', 'novel'].includes(entry.type) && entry.ordinal % 101 >= 70,
        ),
      ),
      ...resultSet(connection, 'dynamic-union-100', matchesDynamic, entries.filter(isDynamic)),
      ...resultSet(
        connection,
        'unclassified',
        `not ${matchesDynamic} and e.id not in (select entry_id from collection_members)`,
        entries.filter((entry) => !isDynamic(entry) && entry.ordinal % 5 !== 0),
      ),
      ...resultSet(
        connection,
        'same-relation',
        `e.id in (select work_id from work_person_links where person_id = '${fixtureId('person', 0)}' and role = 'voiceActor' and character_id is not null)`,
        entries.filter((entry) => prepared.voiceWorks.has(entry.id)),
      ),
    ]

    const identitySql =
      'select entry_id from entry_external_identities where source = ? and source_id = ?'
    const identity = connection.prepare(identitySql)
    queries.push({
      name: 'external-identity',
      statement: identitySql,
      parameters: ['fixture-source', 'source-42000'],
      expectedRows: 1,
      /** Finds the exact source identity without normalizing either coordinate. */
      run: () => identity.get('fixture-source', 'source-42000'),
      /** Confirms that identity lookup returns its original entry. */
      verify: (value) => assert.deepEqual(value, { entry_id: entries[42000]!.id }),
    })

    const dateSql =
      "select id,work_id from work_completion_records order by json_extract(completed_date,'$.year'),json_extract(completed_date,'$.month'),json_extract(completed_date,'$.day'),work_id limit 200 offset 30000"
    const dates = connection.prepare(dateSql)
    const workEntries = entries.filter(
      (entry) =>
        entry.type === 'game' ||
        entry.type === 'anime' ||
        entry.type === 'comic' ||
        entry.type === 'novel',
    )
    const expectedDates = workEntries
      .map((entry, index) => ({ id: fixtureId('completion', index), work_id: entry.id, index }))
      .sort(
        (left, right) =>
          (left.index % 27) - (right.index % 27) ||
          (left.index % 12) - (right.index % 12) ||
          (left.index % 28) - (right.index % 28) ||
          (left.work_id < right.work_id ? -1 : Number(left.work_id > right.work_id)),
      )
    queries.push({
      name: 'calendar-date-order',
      statement: dateSql,
      parameters: [],
      expectedRows: 200,
      /** Reads a distant interval ordered by civil date components. */
      run: () => dates.all(),
      /** Checks date order and its stable owner tie-break. */
      verify: (value) =>
        assert.deepEqual(
          value,
          expectedDates.slice(30000, 30200).map(({ id, work_id }) => ({ id, work_id })),
        ),
    })

    const statisticsSql = `with activity as (select anime_id,sum(duration_ms) as duration from anime_watch_activity group by anime_id), ranked as (select a.entry_id as id,coalesce(activity.duration,0) as duration from animes a left join activity on activity.anime_id=a.entry_id order by duration desc,a.entry_id limit 200) select id,(select count(*) from anime_episodes where anime_id=ranked.id) as parts,(select count(*) from anime_files where anime_id=ranked.id) as files,duration from ranked order by duration desc,id`
    const statistics = connection.prepare(statisticsSql)
    const expectedStatistics = entries
      .filter((entry) => entry.type === 'anime')
      .map((entry) => ({
        id: entry.id,
        parts: 8,
        files: 5,
        duration: prepared.activityTotals.get(entry.id)!,
      }))
      .sort(
        (left, right) =>
          right.duration - left.duration || (left.id < right.id ? -1 : Number(left.id > right.id)),
      )
      .slice(0, 200)
    queries.push({
      name: 'part-file-activity-statistics',
      statement: statisticsSql,
      parameters: [],
      expectedRows: 200,
      /** Computes activity ordering and the selected rows' part and file counts. */
      run: () => statistics.all(),
      /** Confirms every selected aggregate against fixture facts. */
      verify: (value) => assert.deepEqual(value, expectedStatistics),
    })

    const projection = storage.db
      .select({ id: entryTable.id, name: entryTable.name, aliases: entryTable.aliases })
      .from(entryTable)
      .orderBy(asc(entryTable.effectiveSortName), asc(entryTable.id))
      .limit(200)
      .prepare()
    const expectedProjection = [...entries]
      .sort(compareEntries)
      .slice(0, 200)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        aliases: [`別名 ${entry.local}`, `Alias ${entry.local}`],
      }))
    queries.push({
      name: 'drizzle-codec-projection',
      statement: 'select id,name,aliases from entries order by effective_sort_name,id limit 200',
      parameters: [],
      expectedRows: 200,
      /** Reads a typed projection through Drizzle and the production list codec. */
      run: () => projection.all(),
      /** Checks decoded aliases alongside names and stable identities. */
      verify: (value) => assert.deepEqual(value, expectedProjection),
    })

    const results: QueryMeasurement[] = []
    const writeSamplesMs: number[] = []
    /** Measures a durable short transaction that restores the fixture's original favorite state. */
    const write = storage.db.$client.transaction(() => {
      connection
        .prepare('update entry_evaluations set favorite=1-favorite where entry_id=?')
        .run(entries[0]!.id)
      connection
        .prepare('update entry_evaluations set favorite=1-favorite where entry_id=?')
        .run(entries[0]!.id)
    })
    loop.enable()
    for (const query of queries) {
      const firstStart = performance.now()
      const value = query.run()
      const firstReadMs = performance.now() - firstStart
      query.verify(value)
      await setImmediate()
      for (let index = 0; index < workload.warmups; index += 1) {
        query.run()
        await setImmediate()
      }
      const samplesMs: number[] = []
      for (let index = 0; index < workload.samples; index += 1) {
        const start = performance.now()
        query.run()
        samplesMs.push(performance.now() - start)
        await setImmediate()
      }
      const sorted = [...samplesMs].sort((left, right) => left - right)
      results.push({
        name: query.name,
        statement: query.statement,
        parameters: query.parameters,
        expectedRows: query.expectedRows,
        plan: connection.prepare(`explain query plan ${query.statement}`).all(...query.parameters),
        firstReadMs,
        samplesMs,
        medianMs: sorted[Math.floor(sorted.length / 2)]!,
        p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
        maxMs: sorted.at(-1)!,
      })
      await setImmediate()
    }
    for (let index = 0; index < workload.samples; index += 1) {
      const start = performance.now()
      write()
      writeSamplesMs.push(performance.now() - start)
      await setImmediate()
    }
    loop.disable()

    const migrations = await Promise.all(
      (await readdir(options.migrationsDirectory)).map(async (name) => ({
        name,
        sha256: createHash('sha256')
          .update(await readFile(join(options.migrationsDirectory, name, 'migration.sql')))
          .digest('hex'),
      })),
    )
    return {
      workload,
      inputSha256: prepared.inputSha256,
      observedCounts,
      migrations,
      environment: {
        platform: process.platform,
        arch: process.arch,
        osRelease: release(),
        cpu: cpus()[0]?.model,
        memoryBytes: totalmem(),
        versions: process.versions,
        drizzle: manifest.dependencies['drizzle-orm'],
        sqliteDriver: manifest.dependencies['better-sqlite3'],
        sqlite: connection.prepare('select sqlite_version()').pluck().get(),
        journalMode: connection.pragma('journal_mode', { simple: true }),
        synchronous: connection.pragma('synchronous', { simple: true }),
        fullfsync: connection.pragma('fullfsync', { simple: true }),
        nameOrder: connection.prepare('select locale,revision from name_order_state').get(),
        pageCacheKiB: -Number(connection.pragma('cache_size', { simple: true })),
      },
      mode: 'Actual Electron database worker, production fixture build, one full isolated database, reopened connection and warm OS cache; fixture preparation excluded',
      preparationMs: prepared.preparationMs,
      queries: results,
      writeSamplesMs,
      localeSamples,
      eventLoop: { p95Ms: loop.percentile(95) / 1e6, maxMs: loop.max / 1e6 },
      memory: process.memoryUsage(),
    }
  } finally {
    loop.disable()
    storage.close()
  }
}
