// Measure representative SQL shapes in Electron without opening application windows.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { performance, monitorEventLoopDelay } = require('node:perf_hooks')
const { app } = require('electron')

const repo = path.resolve(__dirname, '../../../../..')
const output = path.join(__dirname, 'query-results.json')
const runRoot = path.join(
  repo,
  '.local/refactor-contracts-20261022',
  `query-${crypto.randomUUID()}`
)
const profile = path.join(runRoot, 'electron-profile')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.disableHardwareAcceleration()
const req = createRequire(path.join(repo, 'apps/desktop/package.json'))
const Database = req('better-sqlite3')
const { drizzle } = req('drizzle-orm/better-sqlite3')

const types = ['game', 'anime', 'comic', 'novel', 'character', 'person', 'organization']
const tables = ['games', 'animes', 'comics', 'novels', 'characters', 'persons', 'organizations']
const round = (value) => Math.round(value * 1000) / 1000
const ordered = (rows) =>
  [...rows].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.id - b.id))
const dynamic = (row) =>
  row.work && ((row.rating >= 8 && row.favorite) || (row.active && row.tags.includes(7)))

function open(file) {
  const db = new Database(file)
  db.pragma('foreign_keys=ON')
  db.pragma('journal_mode=WAL')
  db.pragma('synchronous=FULL')
  return db
}

function seed(file, size) {
  const db = open(file)
  db.exec(`
    CREATE TABLE entries(id INTEGER PRIMARY KEY,type TEXT NOT NULL,name TEXT NOT NULL,
      sort_key TEXT NOT NULL,search_text TEXT NOT NULL,is_nsfw INTEGER NOT NULL);
    CREATE INDEX entries_order ON entries(sort_key,id);
    CREATE INDEX entries_type_order ON entries(type,sort_key,id);
    CREATE TABLE evaluations(entry_id INTEGER PRIMARY KEY REFERENCES entries(id),rating REAL,favorite INTEGER NOT NULL);
    CREATE INDEX evaluation_candidates ON evaluations(favorite,rating,entry_id);
    CREATE TABLE tags(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
    CREATE TABLE entry_tags(entry_id INTEGER REFERENCES entries(id),tag_id INTEGER REFERENCES tags(id),
      is_spoiler INTEGER NOT NULL,order_in_entry INTEGER NOT NULL,PRIMARY KEY(entry_id,tag_id));
    CREATE INDEX tags_reverse ON entry_tags(tag_id,entry_id);
    CREATE TABLE collections(id INTEGER PRIMARY KEY,membership_mode TEXT NOT NULL);
    CREATE TABLE collection_members(collection_id INTEGER REFERENCES collections(id),entry_id INTEGER REFERENCES entries(id),
      order_in_collection INTEGER NOT NULL,PRIMARY KEY(collection_id,entry_id));
    CREATE INDEX members_reverse ON collection_members(entry_id,collection_id);
    CREATE TABLE person_works(id INTEGER PRIMARY KEY,work_id INTEGER REFERENCES entries(id),person_id INTEGER REFERENCES entries(id),
      role TEXT NOT NULL,character_id INTEGER REFERENCES entries(id));
    CREATE INDEX person_works_matching ON person_works(work_id,role,character_id);
    CREATE TABLE activities(id INTEGER PRIMARY KEY,work_id INTEGER REFERENCES entries(id),duration_ms INTEGER NOT NULL);
    CREATE TABLE onboarding_state(id INTEGER PRIMARY KEY CHECK(id=1),handled TEXT NOT NULL);
    CREATE TABLE showcase(id INTEGER PRIMARY KEY,name TEXT NOT NULL CHECK(length(name)>0));
    INSERT INTO onboarding_state VALUES(1,'{}');
  `)
  for (const table of tables)
    db.exec(
      `CREATE TABLE ${table}(entry_id INTEGER PRIMARY KEY REFERENCES entries(id),release_date TEXT)`
    )
  for (const kind of types.slice(0, 4))
    db.exec(
      `CREATE TABLE ${kind}_records(work_id INTEGER PRIMARY KEY REFERENCES entries(id),status TEXT); CREATE INDEX ${kind}_status ON ${kind}_records(status,work_id)`
    )
  db.exec(
    `CREATE VIEW work_records AS ${types
      .slice(0, 4)
      .map((kind) => `SELECT work_id,status FROM ${kind}_records`)
      .join(' UNION ALL ')}`
  )
  db.exec(
    `CREATE VIEW work_dates AS ${tables
      .slice(0, 4)
      .map(
        (table) =>
          `SELECT entry_id,json_extract(release_date,'$.year') AS year,json_extract(release_date,'$.month') AS month,json_extract(release_date,'$.day') AS day FROM ${table}`
      )
      .join(' UNION ALL ')}`
  )
  const insertEntry = db.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?)')
  const typed = tables.map((table) => db.prepare(`INSERT INTO ${table} VALUES(?,?)`))
  const records = types
    .slice(0, 4)
    .map((kind) => db.prepare(`INSERT INTO ${kind}_records VALUES(?,?)`))
  const evaluation = db.prepare('INSERT INTO evaluations VALUES(?,?,?)')
  const tag = db.prepare('INSERT INTO tags VALUES(?,?)')
  const tagLink = db.prepare('INSERT INTO entry_tags VALUES(?,?,0,?)')
  const collection = db.prepare("INSERT INTO collections VALUES(?,'manual')")
  const member = db.prepare('INSERT INTO collection_members VALUES(?,?,?)')
  const relation = db.prepare('INSERT INTO person_works VALUES(?,?,?,?,?)')
  const rows = []
  db.transaction(() => {
    for (let id = 1; id <= 500; id++) tag.run(id, `标签 ${id}`)
    for (let id = 1; id <= 10; id++) collection.run(id)
    for (let id = 1; id <= size; id++) {
      const kind = (id - 1) % 7
      const name = `星屿 作品 ${id % 997}`
      const row = {
        id,
        type: types[kind],
        work: kind < 4,
        name,
        sortKey: `星屿 作品 ${String(id % 997).padStart(4, '0')}`,
        visible: id % 11 !== 0,
        rating: (id % 21) / 2,
        favorite: id % 5 === 0,
        active: id % 4 === 0,
        tags: Array.from({ length: 8 }, (_, i) => 1 + ((id + 17 * i) % 500)),
        manual: id % 3 === 0,
        relations: []
      }
      rows.push(row)
      insertEntry.run(
        id,
        row.type,
        name,
        row.sortKey,
        `${name} 静かな海の記憶`,
        row.visible ? 0 : 1
      )
      const year = id % 13 === 0 ? null : 1980 + (id % 46)
      row.year = year
      row.month = id % 4 === 0 ? null : 1 + (id % 12)
      row.day = id % 8 === 0 ? null : 1 + (id % 27)
      const date = Object.fromEntries(
        ['year', 'month', 'day'].filter((key) => row[key] !== null).map((key) => [key, row[key]])
      )
      typed[kind].run(id, Object.keys(date).length ? JSON.stringify(date) : null)
      evaluation.run(id, row.rating, row.favorite ? 1 : 0)
      if (row.work) records[kind].run(id, row.active ? 'active' : null)
      for (let i = 0; i < row.tags.length; i++) tagLink.run(id, row.tags[i], i)
      if (row.manual) member.run(1 + (id % 10), id, id)
    }
    const characters = rows.filter((row) => row.type === 'character').map((row) => row.id)
    const people = rows.filter((row) => row.type === 'person').map((row) => row.id)
    let relationId = 0
    for (const row of rows.filter((row) => row.work)) {
      for (let i = 0; i < 4; i++) {
        const role = i % 2 === 0 ? 'voiceActor' : 'other'
        const character = characters[(row.id + 7 * i) % characters.length]
        row.relations.push({ role, character })
        relation.run(++relationId, row.id, people[(row.id + i) % people.length], role, character)
      }
    }
  })()
  const counts = {
    entries: size,
    entryTags: db.prepare('SELECT count(*) AS n FROM entry_tags').get().n,
    personWorks: db.prepare('SELECT count(*) AS n FROM person_works').get().n,
    collectionMembers: db.prepare('SELECT count(*) AS n FROM collection_members').get().n
  }
  assert.equal(db.pragma('foreign_key_check').length, 0)
  db.close()
  return { rows, counts }
}

const dynamicSql = `(e.type IN ('game','anime','comic','novel') AND (
  EXISTS(SELECT 1 FROM evaluations v WHERE v.entry_id=e.id AND v.rating>=8 AND v.favorite=1)
  OR (EXISTS(SELECT 1 FROM work_records r WHERE r.work_id=e.id AND r.status='active')
      AND EXISTS(SELECT 1 FROM entry_tags t WHERE t.entry_id=e.id AND t.tag_id=7))))`

const dynamicSetSql = `e.id IN (
  SELECT v.entry_id FROM evaluations v JOIN entries w ON w.id=v.entry_id
    WHERE v.favorite=1 AND v.rating>=8 AND w.type IN ('game','anime','comic','novel')
  UNION
  SELECT r.work_id FROM work_records r JOIN entry_tags t ON t.entry_id=r.work_id
    WHERE r.status='active' AND t.tag_id=7)`

function rangeCase(db, name, where, expected, offset) {
  const listSql = `SELECT e.id FROM entries e WHERE e.is_nsfw=0 AND (${where}) ORDER BY e.sort_key,e.id LIMIT 80 OFFSET ?`
  const countSql = `SELECT count(*) AS n FROM entries e WHERE e.is_nsfw=0 AND (${where})`
  const list = db.prepare(listSql),
    count = db.prepare(countSql)
  const run = db.transaction(() => ({
    ids: list.all(offset).map((row) => row.id),
    total: count.get().n
  }))
  const validate = (result) => {
    assert.equal(result.total, expected.length)
    assert.deepEqual(
      result.ids,
      expected.slice(offset, offset + 80).map((row) => row.id)
    )
  }
  return { name, run, validate, plan: db.prepare('EXPLAIN QUERY PLAN ' + listSql).all(offset) }
}

function locateCase(db, expected, window, setBased = false) {
  const where = `e.is_nsfw=0 AND (${setBased ? dynamicSetSql : dynamicSql})`
  const target = expected[Math.floor(expected.length * 0.9)]
  const total = db.prepare(`SELECT count(*) AS n FROM entries e WHERE ${where}`)
  const position = window
    ? db.prepare(
        `WITH ranked AS (SELECT e.id,row_number() OVER (ORDER BY e.sort_key,e.id)-1 AS n FROM entries e WHERE ${where}) SELECT n FROM ranked WHERE id=?`
      )
    : db.prepare(
        `SELECT count(*) AS n FROM entries e WHERE ${where} AND (e.sort_key<? OR (e.sort_key=? AND e.id<?))`
      )
  const list = db.prepare(
    `SELECT e.id FROM entries e WHERE ${where} ORDER BY e.sort_key,e.id LIMIT 80 OFFSET ?`
  )
  const run = db.transaction(() => {
    const index = (
      window ? position.get(target.id) : position.get(target.sortKey, target.sortKey, target.id)
    ).n
    const offset = Math.max(0, index - 40)
    return { index, offset, total: total.get().n, ids: list.all(offset).map((row) => row.id) }
  })
  return {
    name: setBased
      ? 'dynamic-locate-indexed-set'
      : window
        ? 'dynamic-locate-window'
        : 'dynamic-locate-indexed-rank',
    run,
    validate: (result) => {
      assert.equal(result.total, expected.length)
      assert.equal(expected[result.index].id, target.id)
      assert.deepEqual(
        result.ids,
        expected.slice(result.offset, result.offset + 80).map((row) => row.id)
      )
    },
    plan: db
      .prepare('EXPLAIN QUERY PLAN ' + position.source)
      .all(...(window ? [target.id] : [target.sortKey, target.sortKey, target.id]))
  }
}

function dateCase(db, rows) {
  const compare = (a, b) => {
    for (const key of ['year', 'month', 'day']) {
      if (a[key] === b[key]) continue
      if (a[key] === null) return 1
      if (b[key] === null) return -1
      return a[key] - b[key]
    }
    return a.id - b.id
  }
  const expected = rows
    .filter((row) => row.visible && row.work && row.year >= 2000 && row.year <= 2024)
    .sort(compare)
  const offset = Math.floor(expected.length * 0.8)
  const sql = `SELECT e.id FROM work_dates d JOIN entries e ON e.id=d.entry_id
    WHERE e.is_nsfw=0 AND d.year BETWEEN 2000 AND 2024
    ORDER BY d.year,d.month IS NULL,d.month,d.day IS NULL,d.day,e.id LIMIT 80 OFFSET ?`
  const list = db.prepare(sql)
  const count = db.prepare(
    'SELECT count(*) AS n FROM work_dates d JOIN entries e ON e.id=d.entry_id WHERE e.is_nsfw=0 AND d.year BETWEEN 2000 AND 2024'
  )
  return {
    name: 'partial-date-json-range',
    run: db.transaction(() => ({
      ids: list.all(offset).map((row) => row.id),
      total: count.get().n
    })),
    validate: (result) => {
      assert.equal(result.total, expected.length)
      assert.deepEqual(
        result.ids,
        expected.slice(offset, offset + 80).map((row) => row.id)
      )
    },
    plan: db.prepare('EXPLAIN QUERY PLAN ' + sql).all(offset)
  }
}

function measure(test) {
  let start = performance.now()
  test.validate(test.run())
  const firstReadMs = performance.now() - start
  for (let i = 0; i < 3; i++) test.run()
  const samples = []
  for (let i = 0; i < 31; i++) {
    start = performance.now()
    test.run()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  return {
    name: test.name,
    firstReadMs: round(firstReadMs),
    medianMs: round(samples[15]),
    p95Ms: round(samples[29]),
    maxMs: round(samples[30]),
    plan: test.plan
  }
}

function verifyAtomicAdoption(db) {
  const adopt = db.transaction((fail) => {
    db.prepare('INSERT INTO showcase VALUES(1,?)').run('recently used')
    if (fail) throw new Error('injected before handled commit')
    db.prepare('UPDATE onboarding_state SET handled=? WHERE id=1').run(
      '{"sample":{"outcome":"applied"}}'
    )
  })
  assert.throws(() => adopt(true))
  assert.equal(db.prepare('SELECT count(*) AS n FROM showcase').get().n, 0)
  assert.equal(db.prepare('SELECT handled FROM onboarding_state').get().handled, '{}')
  adopt(false)
  assert.equal(db.prepare('SELECT count(*) AS n FROM showcase').get().n, 1)
  assert.equal(
    JSON.parse(db.prepare('SELECT handled FROM onboarding_state').get().handled).sample.outcome,
    'applied'
  )
  const rowCount = db.prepare('SELECT count(*) AS n FROM showcase').get().n
  assert.throws(() =>
    db.transaction(() => {
      db.prepare('INSERT INTO showcase VALUES(2,?)').run('valid')
      db.prepare('INSERT INTO showcase VALUES(3,?)').run('')
    })()
  )
  assert.equal(db.prepare('SELECT count(*) AS n FROM showcase').get().n, rowCount)
  return { rollbackBeforeHandled: true, commitTogether: true, multipleCreateRollback: true }
}

async function main() {
  const report = {
    runtime: {
      electron: process.versions.electron,
      node: process.versions.node,
      modules: process.versions.modules,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpu: os.cpus()[0].model,
      logicalCores: os.cpus().length,
      memoryGiB: round(os.totalmem() / 2 ** 30),
      betterSqlite3: req('better-sqlite3/package.json').version,
      drizzleOrm: JSON.parse(
        fs.readFileSync(path.join(path.dirname(req.resolve('drizzle-orm')), 'package.json'), 'utf8')
      ).version,
      journalMode: 'wal',
      synchronous: 'full'
    },
    sampleCount: 31,
    results: [],
    scope:
      'Synthetic representative SQL shapes; current driver/runtime, not the full schema or Drizzle 1.x integration'
  }
  for (const size of [1000, 10000, 50000]) {
    const file = path.join(runRoot, `library-${size}.sqlite`)
    const { rows, counts } = seed(file, size)
    const db = open(file)
    report.runtime.sqlite = db.prepare('SELECT sqlite_version() AS version').get().version
    assert.equal(drizzle(db).get('SELECT count(*) AS n FROM entries').n, size)
    const visible = ordered(rows.filter((row) => row.visible))
    const novels = visible.filter((row) => row.type === 'novel')
    const dynamics = visible.filter(dynamic)
    const unclassified = visible.filter((row) => !row.manual && !dynamic(row))
    const characters = rows.filter((row) => row.type === 'character').map((row) => row.id)
    const ceiling = characters[Math.min(20, characters.length - 1)]
    const related = visible.filter((row) =>
      row.relations.some((item) => item.role === 'voiceActor' && item.character <= ceiling)
    )
    const cases = [
      rangeCase(db, 'novel-far-range', "e.type='novel'", novels, Math.floor(novels.length * 0.9)),
      rangeCase(
        db,
        'same-relation-filter',
        `EXISTS(SELECT 1 FROM person_works p WHERE p.work_id=e.id AND p.role='voiceActor' AND p.character_id<=${ceiling})`,
        related,
        0
      ),
      rangeCase(db, 'dynamic-union-range', dynamicSql, dynamics, Math.floor(dynamics.length * 0.8)),
      rangeCase(
        db,
        'unclassified-range',
        `NOT EXISTS(SELECT 1 FROM collection_members m WHERE m.entry_id=e.id) AND NOT ${dynamicSql}`,
        unclassified,
        Math.floor(unclassified.length * 0.9)
      ),
      rangeCase(
        db,
        'cjk-substring-range',
        "instr(e.search_text,'星屿')>0 AND instr(e.search_text,'記憶')>0",
        visible,
        Math.floor(visible.length * 0.9)
      ),
      locateCase(db, dynamics, true),
      locateCase(db, dynamics, false),
      rangeCase(
        db,
        'dynamic-indexed-set-range',
        dynamicSetSql,
        dynamics,
        Math.floor(dynamics.length * 0.8)
      ),
      rangeCase(
        db,
        'unclassified-indexed-set-range',
        `NOT EXISTS(SELECT 1 FROM collection_members m WHERE m.entry_id=e.id) AND NOT (${dynamicSetSql})`,
        unclassified,
        Math.floor(unclassified.length * 0.9)
      ),
      locateCase(db, dynamics, true, true),
      dateCase(db, rows)
    ]
    const measured = cases.map(measure)
    const atomicAdoption = verifyAtomicAdoption(db)
    const histogram = monitorEventLoopDelay({ resolution: 10 })
    histogram.enable()
    await new Promise((resolve) => setTimeout(resolve, 25))
    const workId = rows.find((row) => row.work).id
    const write = db.prepare('INSERT INTO activities(work_id,duration_ms) VALUES(?,?)')
    const optimized = cases.filter(
      (item) =>
        ![
          'dynamic-union-range',
          'unclassified-range',
          'dynamic-locate-window',
          'dynamic-locate-indexed-rank'
        ].includes(item.name)
    )
    for (let i = 0; i < 35; i++) {
      optimized[i % optimized.length].run()
      write.run(workId, 1000 + i)
      await new Promise((resolve) => setImmediate(resolve))
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
    histogram.disable()
    report.results.push({
      counts,
      queries: measured,
      atomicAdoption,
      eventLoop: {
        resolutionMs: 10,
        p95Ms: round(histogram.percentile(95) / 1e6),
        maxMs: round(histogram.max / 1e6)
      },
      backgroundWrites: 35,
      eventLoopQueries: optimized.map((item) => item.name)
    })
    db.close()
  }
  fs.writeFileSync(output, JSON.stringify(report, null, 2))
}

app
  .whenReady()
  .then(main)
  .then(() => app.exit(0))
  .catch((error) => {
    fs.writeFileSync(path.join(runRoot, 'error.txt'), error.stack)
    console.error(error)
    app.exit(1)
  })
