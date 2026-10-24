// Exercise the declared date value domain without implementing application forms.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { performance } = require('node:perf_hooks')
const { app } = require('electron')
const root = __dirname
const profile = path.join(root, 'date-profile')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.disableHardwareAcceleration()

const maximumYear = Number.MAX_SAFE_INTEGER
const has = (value, key) => Object.hasOwn(value, key)
const leap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
const monthLength = (year, month) =>
  [31, year === undefined || leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ]

function parseDate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (Object.getPrototypeOf(value) !== Object.prototype) return null
  const keys = Object.keys(value)
  if (!keys.length || keys.some((key) => !['year', 'month', 'day'].includes(key))) return null
  if (keys.some((key) => !Number.isSafeInteger(value[key]))) return null
  if (has(value, 'month') && (value.month < 1 || value.month > 12)) return null
  if (
    has(value, 'day') &&
    (value.day < 1 || value.day > (has(value, 'month') ? monthLength(value.year, value.month) : 31))
  )
    return null
  return Object.fromEntries(
    ['year', 'month', 'day']
      .filter((key) => has(value, key))
      .map((key) => [key, Object.is(value[key], -0) ? 0 : value[key]])
  )
}

function encodeDate(value) {
  if (value === null) return null
  const parsed = parseDate(value)
  if (!parsed) throw new Error('Invalid date.')
  return JSON.stringify(parsed)
}

function decodeDate(value) {
  if (value === null) return null
  try {
    return parseDate(JSON.parse(value))
  } catch {
    return null
  }
}

function parseEraYear(era, digits) {
  if (!/^[0-9]{1,16}$/.test(digits)) throw new Error('Invalid year input.')
  const eraYear = BigInt(digits)
  if (eraYear < 1n) throw new Error('Invalid era year.')
  const year = era === 'bce' ? 1n - eraYear : eraYear
  if (year < -BigInt(maximumYear) || year > BigInt(maximumYear))
    throw new Error('Year out of range.')
  return Number(year)
}

const compare = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  return 0
}

function extent(date) {
  if (!has(date, 'year')) return null
  const firstMonth = date.month ?? 1
  const lastMonth = date.month ?? 12
  return [
    [date.year, firstMonth, date.day ?? 1],
    [date.year, lastMonth, date.day ?? monthLength(date.year, lastMonth)]
  ]
}

function within(date, from, to) {
  const bounds = extent(date)
  return bounds !== null && compare(bounds[0], from) >= 0 && compare(bounds[1], to) <= 0
}

function monthDayWithin(date, from, to) {
  const wraps = compare(from, to) > 0
  for (let month = 1; month <= 12; month++) {
    if (date.month !== undefined && date.month !== month) continue
    for (let day = 1; day <= monthLength(date.year, month); day++) {
      if (date.day !== undefined && date.day !== day) continue
      const point = [month, day]
      const after = compare(point, from) >= 0
      const before = compare(point, to) <= 0
      if (!(wraps ? after || before : after && before)) return false
    }
  }
  return true
}

app.whenReady().then(() => {
  const started = performance.now()
  const result = {
    scope: 'Date contract arithmetic and SQLite fixture; no application forms',
    versions: { electron: process.versions.electron, node: process.versions.node },
    groups: []
  }
  const check = (name, run) => {
    const count = run()
    result.groups.push({ name, assertions: count, passed: true })
  }
  let client
  try {
    check(
      'Full Gregorian cycle agrees with UTC date normalization as an independent oracle',
      () => {
        let count = 0
        for (let year = 2000; year < 2400; year++)
          for (let month = 1; month <= 12; month++)
            for (let day = 0; day <= 32; day++) {
              const actual = parseDate({ year, month, day }) !== null
              const oracle = new Date(Date.UTC(year, month - 1, day))
              assert.equal(
                actual,
                oracle.getUTCFullYear() === year &&
                  oracle.getUTCMonth() === month - 1 &&
                  oracle.getUTCDate() === day
              )
              count++
            }
        return count
      }
    )
    check(
      'All seven nonempty component sets round trip without synthesizing unknown fields',
      () => {
        for (let mask = 1; mask < 8; mask++) {
          const input = Object.fromEntries(
            Object.entries({ year: 2000, month: 2, day: 29 }).filter(
              (_, index) => mask & (1 << index)
            )
          )
          assert.deepEqual(decodeDate(encodeDate(input)), input)
        }
        for (const input of [
          {},
          [],
          { year: null },
          { year: undefined },
          { year: NaN },
          { year: Infinity },
          { year: maximumYear + 1 },
          { year: -maximumYear - 1 },
          { year: 1.5 },
          { month: 0 },
          { month: 13 },
          { month: 2, day: 30 },
          { day: 32 },
          { year: 1900, month: 2, day: 29 },
          { year: 2024, precision: 'year' }
        ])
          assert.throws(() => encodeDate(input))
        assert.deepEqual(parseDate({ year: -0 }), { year: 0 })
        assert.equal(decodeDate('{broken'), null)
        return 24
      }
    )
    check('Boundary leap years match exact BigInt arithmetic', () => {
      let count = 0
      for (const sign of [-1, 1])
        for (let delta = 0; delta < 1000; delta++) {
          const year = sign * (maximumYear - delta)
          const exact = BigInt(year)
          assert.equal(
            leap(year),
            exact % 4n === 0n && (exact % 100n !== 0n || exact % 400n === 0n)
          )
          count++
        }
      return count
    })
    check('Era display and form conversion remain exact at both safe-integer endpoints', () => {
      const years = [-maximumYear, -12000, -1, 0, 1, 2026, 12000, maximumYear]
      for (const year of years)
        for (const locale of ['zh-CN', 'zh-TW', 'en-US', 'ja-JP']) {
          const era = year <= 0 ? 'bce' : 'ce'
          const exact = year <= 0 ? 1n - BigInt(year) : BigInt(year)
          const digits = new Intl.NumberFormat(locale, { useGrouping: false }).format(exact)
          assert.equal(parseEraYear(era, digits), year)
        }
      assert.equal(parseEraYear('bce', '9007199254740992'), -maximumYear)
      assert.throws(() => parseEraYear('ce', '9007199254740992'))
      assert.throws(() => parseEraYear('bce', '9007199254740993'))
      assert.throws(() => parseEraYear('ce', '0'))
      return 36
    })
    check('Absolute and recurring ranges retain unknown precision', () => {
      assert.equal(within({ year: 2024 }, [2024, 1, 1], [2024, 12, 31]), true)
      assert.equal(within({ year: 2024 }, [2024, 5, 1], [2024, 5, 31]), false)
      assert.equal(within({ year: 2024, day: 31 }, [2024, 1, 31], [2024, 12, 31]), true)
      assert.equal(within({ year: 2024, day: 31 }, [2024, 2, 1], [2024, 12, 31]), false)
      assert.equal(within({ month: 5, day: 3 }, [2024, 1, 1], [2024, 12, 31]), false)
      assert.equal(within({ year: maximumYear }, [maximumYear, 1, 1], [maximumYear, 12, 31]), true)
      assert.equal(
        within({ year: -maximumYear }, [-maximumYear, 1, 1], [-maximumYear, 12, 31]),
        true
      )
      assert.equal(monthDayWithin({ month: 1, day: 3 }, [12, 20], [1, 10]), true)
      assert.equal(monthDayWithin({ month: 5 }, [5, 1], [5, 31]), true)
      assert.equal(monthDayWithin({ month: 5 }, [5, 3], [5, 31]), false)
      assert.equal(monthDayWithin({ day: 31 }, [1, 1], [12, 31]), true)
      assert.equal(monthDayWithin({ day: 31 }, [12, 20], [1, 10]), false)
      assert.equal(monthDayWithin({ month: 2, day: 29 }, [2, 1], [2, 29]), true)
      return 13
    })
    const req = createRequire(path.resolve('apps/desktop/package.json'))
    const Database = req('better-sqlite3')
    client = new Database(':memory:')
    result.versions.sqlite = client.prepare('select sqlite_version() as version').get().version
    client.exec('CREATE TABLE dates(id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
    const dates = []
    for (const year of [
      -maximumYear,
      -12000,
      -401,
      -1,
      0,
      1,
      1900,
      2000,
      2024,
      12000,
      maximumYear
    ]) {
      for (let mask = 1; mask < 8; mask++)
        dates.push(
          Object.fromEntries(
            Object.entries({ year, month: 2, day: 28 }).filter((_, index) => mask & (1 << index))
          )
        )
    }
    const insert = client.prepare('INSERT INTO dates(value) VALUES (?)')
    client.transaction(() => dates.forEach((date) => insert.run(encodeDate(date))))()
    const projection = `SELECT id, json_extract(value,'$.year') AS y, json_extract(value,'$.month') AS m, json_extract(value,'$.day') AS d FROM dates`
    check('SQLite JSON extraction preserves safe-integer years and missing components', () => {
      const rows = client.prepare(projection).all()
      rows.forEach((row, index) =>
        assert.deepEqual(
          [row.y, row.m, row.d],
          [dates[index].year ?? null, dates[index].month ?? null, dates[index].day ?? null]
        )
      )
      assert.equal(
        client
          .prepare(
            "SELECT count(*) AS n FROM dates WHERE json_type(value,'$.year') IS NOT NULL AND typeof(json_extract(value,'$.year')) != 'integer'"
          )
          .get().n,
        0
      )
      return dates.length + 1
    })
    check('SQL range, count and position agree with independent component predicates', () => {
      const sql = `WITH parts AS (${projection}), bounds AS (SELECT *, coalesce(m,1) AS lm, coalesce(d,1) AS ld, coalesce(m,12) AS hm, coalesce(d,CASE WHEN m=2 THEN CASE WHEN y%4=0 AND (y%100!=0 OR y%400=0) THEN 29 ELSE 28 END WHEN m IN (4,6,9,11) THEN 30 ELSE 31 END) AS hd FROM parts) SELECT id FROM bounds WHERE y IS NOT NULL AND (y,lm,ld) >= (?,?,?) AND (y,hm,hd) <= (?,?,?) ORDER BY id`
      const ranges = [
        [
          [-maximumYear, 1, 1],
          [-maximumYear, 12, 31]
        ],
        [
          [-maximumYear, 1, 1],
          [maximumYear, 12, 31]
        ],
        [
          [0, 1, 1],
          [2024, 12, 31]
        ],
        [
          [2024, 2, 1],
          [2024, 2, 29]
        ],
        [
          [2024, 2, 28],
          [2024, 2, 28]
        ],
        [
          [maximumYear, 1, 1],
          [maximumYear, 12, 31]
        ]
      ]
      ranges.forEach(([from, to]) => {
        const actual = client
          .prepare(sql)
          .all(...from, ...to)
          .map((row) => row.id)
        const expected = dates.flatMap((date, index) => (within(date, from, to) ? [index + 1] : []))
        assert.deepEqual(actual, expected)
        assert.equal(
          client.prepare(`SELECT count(*) AS n FROM (${sql})`).get(...from, ...to).n,
          expected.length
        )
        if (expected.length)
          assert.equal(
            client
              .prepare(
                `SELECT position FROM (SELECT id,row_number() OVER (ORDER BY id)-1 AS position FROM (${sql})) WHERE id=?`
              )
              .get(...from, ...to, expected.at(-1)).position,
            expected.length - 1
          )
      })
      return ranges.length * 3
    })
    client.close()
    result.elapsedMs = performance.now() - started
    result.passed = true
    fs.writeFileSync(path.join(root, 'date-results.json'), JSON.stringify(result, null, 2))
    app.exit(0)
  } catch (error) {
    if (client?.open) client.close()
    result.passed = false
    result.error = { message: error.message, stack: error.stack }
    fs.writeFileSync(path.join(root, 'date-results.json'), JSON.stringify(result, null, 2))
    app.exit(1)
  }
})
