const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { pathToFileURL } = require('node:url')
const { app } = require('electron')

const fixture = __dirname
const run = path.join(fixture, 'runs', String(Date.now()))
fs.mkdirSync(run, { recursive: true })
app.setPath('userData', path.join(run, 'profile'))
app.setPath('sessionData', path.join(run, 'profile'))
app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const result = {
    fixture: 'Drizzle RC compatibility, not application acceptance',
    versions: {},
    checks: []
  }
  let client
  const check = (name, fn) => {
    fn()
    result.checks.push({ name, passed: true })
  }
  try {
    const appRequire = createRequire(
      path.resolve(process.env.KISAKI_PROBE_APP_PACKAGE || 'apps/desktop/package.json')
    )
    const Database = appRequire('better-sqlite3')
    const { drizzle } = await import('drizzle-orm/better-sqlite3')
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
    const { eq, inArray, notInArray } = await import('drizzle-orm')
    const { entries, identities, relations } = await import(
      pathToFileURL(path.join(fixture, 'build/schema.js')).href
    )
    const migrationNames = fs.readdirSync(path.join(fixture, 'migrations')).sort()
    assert.equal(migrationNames.length, 2)
    const baseline = path.join(run, 'baseline')
    fs.mkdirSync(baseline)
    fs.cpSync(
      path.join(fixture, 'migrations', migrationNames[0]),
      path.join(baseline, migrationNames[0]),
      { recursive: true }
    )
    const dbFile = path.join(run, 'test.sqlite')
    const open = () => {
      client = new Database(dbFile)
      client.pragma('foreign_keys = ON')
      client.pragma('journal_mode = WAL')
      client.pragma('synchronous = FULL')
      return drizzle({ client, relations })
    }
    let db = open()
    result.versions = {
      electron: process.versions.electron,
      node: process.versions.node,
      modules: process.versions.modules,
      sqlite: client.prepare('select sqlite_version() as version').get().version,
      betterSqlite3: appRequire('better-sqlite3/package.json').version,
      orm: require('./node_modules/drizzle-orm/package.json').version,
      kit: require('./node_modules/drizzle-kit/package.json').version
    }
    check('Generated baseline migrates synchronously', () => {
      assert.equal(migrate(db, { migrationsFolder: baseline }), undefined)
      assert.equal(client.prepare('select count(*) as n from __drizzle_migrations').get().n, 1)
      client
        .prepare('insert into entries(id,name,released,favorite) values(?,?,?,?)')
        .run('a', 'Original', '{"year":2024,"month":2,"day":29}', 1)
    })
    client.close()
    db = open()
    check('Forward migration preserves stored choices and adds the declared default', () => {
      migrate(db, { migrationsFolder: path.join(fixture, 'migrations') })
      assert.deepEqual(db.select().from(entries).get(), {
        id: 'a',
        name: 'Original',
        released: { year: 2024, month: 2, day: 29 },
        favorite: true,
        note: ''
      })
      assert.equal(client.prepare('select count(*) as n from __drizzle_migrations').get().n, 2)
    })
    client.close()
    db = open()
    check('Reopen does not reapply completed migrations', () => {
      db.update(entries).set({ note: 'Preserved' }).where(eq(entries.id, 'a')).run()
      migrate(db, { migrationsFolder: path.join(fixture, 'migrations') })
      assert.equal(db.select().from(entries).get().note, 'Preserved')
      assert.equal(client.prepare('select count(*) as n from __drizzle_migrations').get().n, 2)
    })
    check('Strict codec rejects malformed writes without modifying data', () => {
      for (const released of [
        { year: 2023, month: 2, day: 29 },
        { year: '2024' },
        { year: 2024, alien: true }
      ]) {
        assert.throws(() => db.update(entries).set({ released }).where(eq(entries.id, 'a')).run())
      }
      assert.deepEqual(db.select().from(entries).get().released, { year: 2024, month: 2, day: 29 })
    })
    check('Lenient reads handle malformed JSON in both direct and relational projections', () => {
      db.insert(entries).values({ id: 'b', name: 'Empty' }).run()
      db.insert(entries).values({ id: 'c', name: 'Malformed' }).run()
      client.prepare('update entries set released=? where id=?').run('{malformed', 'c')
      assert.equal(db.select().from(entries).where(eq(entries.id, 'c')).get().released, null)
      assert.equal(db.query.entries.findFirst({ where: { id: 'c' } }).sync().released, null)
      assert.deepEqual(db.query.entries.findFirst({ where: { id: 'a' } }).sync().released, {
        year: 2024,
        month: 2,
        day: 29
      })
      db.insert(identities).values({ source: 'case', sourceId: 'A:Full/01', entryId: 'a' }).run()
      assert.equal(
        db.query.identities.findFirst({ with: { entry: true } }).sync().entry.released.year,
        2024
      )
    })
    check('Null and numeric zero retain distinct storage values', () => {
      db.update(entries)
        .set({ released: { year: 0 }, favorite: false })
        .where(eq(entries.id, 'b'))
        .run()
      assert.deepEqual(db.select().from(entries).where(eq(entries.id, 'b')).get().released, {
        year: 0
      })
      db.update(entries).set({ released: null }).where(eq(entries.id, 'b')).run()
      assert.equal(db.select().from(entries).where(eq(entries.id, 'b')).get().released, null)
    })
    check('Empty relation presence and absence match actual facts', () => {
      const ids = (where) =>
        db.query.entries
          .findMany({ where, orderBy: { id: 'asc' }, columns: { id: true } })
          .sync()
          .map((row) => row.id)
      assert.deepEqual(ids({ identities: true }), ['a'])
      assert.deepEqual(ids({ identities: false }), ['b', 'c'])
      assert.deepEqual(ids({ identities: { source: 'case', sourceId: 'A:Full/01' } }), ['a'])
      assert.deepEqual(ids({ identities: { source: 'case', sourceId: 'a:Full/01' } }), [])
      assert.deepEqual(
        db.query.entries.findFirst({ where: { id: 'b' }, with: { identities: true } }).sync()
          .identities,
        []
      )
    })
    check('ORM empty IN semantics are explicit; public queries must reject empty operands', () => {
      assert.equal(db.select().from(entries).where(inArray(entries.id, [])).all().length, 0)
      assert.equal(db.select().from(entries).where(notInArray(entries.id, [])).all().length, 3)
    })
    check(
      'Unique identities, foreign keys, CHECK and short transactions enforce constraints',
      () => {
        assert.throws(() =>
          db
            .insert(identities)
            .values({ source: 'case', sourceId: 'A:Full/01', entryId: 'b' })
            .run()
        )
        assert.throws(() =>
          db
            .insert(identities)
            .values({ source: 'case', sourceId: 'missing', entryId: 'missing' })
            .run()
        )
        assert.throws(() =>
          db.transaction((tx) => {
            tx.update(entries).set({ name: 'Would change' }).where(eq(entries.id, 'a')).run()
            tx.insert(entries).values({ id: 'invalid', name: '' }).run()
          })
        )
        assert.equal(db.select().from(entries).where(eq(entries.id, 'a')).get().name, 'Original')
      }
    )
    check('A failing pending migration rolls back schema, rows and applied history', () => {
      const broken = path.join(run, 'broken')
      fs.cpSync(path.join(fixture, 'migrations'), broken, { recursive: true })
      const failing = path.join(broken, '20990101000000_failure')
      fs.mkdirSync(failing)
      fs.writeFileSync(
        path.join(failing, 'migration.sql'),
        "CREATE TABLE should_rollback (id INTEGER);\n--> statement-breakpoint\nUPDATE entries SET note='Wrong';\n--> statement-breakpoint\nINSERT INTO entries(id,name) VALUES('a','Duplicate');"
      )
      assert.throws(() => migrate(db, { migrationsFolder: broken }))
      assert.equal(
        client.prepare("select count(*) as n from sqlite_master where name='should_rollback'").get()
          .n,
        0
      )
      assert.equal(db.select().from(entries).where(eq(entries.id, 'a')).get().note, 'Preserved')
      assert.equal(client.prepare('select count(*) as n from __drizzle_migrations').get().n, 2)
    })
    client.close()
    db = open()
    check('Reopen after failed migration preserves the last committed database', () => {
      assert.equal(db.select().from(entries).all().length, 3)
      assert.equal(client.prepare('pragma integrity_check').get().integrity_check, 'ok')
      assert.deepEqual(client.pragma('foreign_key_check'), [])
    })
    client.close()
    result.passed = true
    fs.writeFileSync(path.join(fixture, 'results.json'), JSON.stringify(result, null, 2))
    app.exit(0)
  } catch (error) {
    if (client?.open) client.close()
    result.passed = false
    result.failure = { name: error.name, message: error.message, stack: error.stack }
    fs.writeFileSync(path.join(fixture, 'results.json'), JSON.stringify(result, null, 2))
    app.exit(1)
  }
})
