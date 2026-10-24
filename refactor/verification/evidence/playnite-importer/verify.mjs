import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const [readerInput, fixtureInput] = process.argv.slice(2)
assert(
  readerInput && fixtureInput,
  'Reader executable and synthetic fixture directory are required.'
)
const reader = resolve(readerInput)
const fixture = resolve(fixtureInput)
const tests = []
const check = (name, predicate) => {
  assert(predicate, name)
  tests.push(name)
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const dbPath = join(fixture, 'synthetic-games.db')
const zipPath = join(fixture, 'synthetic-backup.zip')
const bytes = readFileSync(dbPath)
const before = { database: hash(bytes), archive: hash(readFileSync(zipPath)) }
const decoded = spawnSync(reader, [], {
  input: bytes,
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024
})
assert.equal(decoded.status, 0, 'Synthetic stdin decoding must succeed.')
const rows = decoded.stdout
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
check(
  'five live records; deleted record absent',
  rows.length === 5 && rows.every((row) => row.collection === 'Game')
)
const docs = rows.map((row) => row.document)
const byId = (n) =>
  docs.find((doc) => doc._id.$guid === '10000000-0000-0000-0000-' + String(n).padStart(12, '0'))
check('zero score remains a rated value', byId(1).UserScore === 0)
check('maximum score remains exact', byId(2).UserScore === 100)
check(
  'explicit null and omitted score remain distinct in transport',
  byId(3).UserScore === null && !Object.hasOwn(byId(4), 'UserScore')
)
check(
  'personal favorite and false values survive',
  byId(1).Favorite === true && byId(2).Favorite === false
)
check(
  'plain notes preserve lines and literal markup',
  byId(1).Notes === 'Plain note\n<literal markup> & a second line'
)
check('partial date remains partial', byId(1).ReleaseDate === '2020-5')
check(
  '64-bit seconds are not rounded through JSON',
  BigInt(byId(5).Playtime.$numberLong) === 9007199254740993n
)
check(
  '64-bit launch count remains separate',
  BigInt(byId(5).PlayCount.$numberLong) === 9007199254740995n
)
check(
  'out-of-range duration can be detected before numeric adoption',
  BigInt(byId(5).Playtime.$numberLong) * 1000n > BigInt(Number.MAX_SAFE_INTEGER)
)
check('UTC date retains the source instant', byId(1).Added.$date === '2025-07-03T10:20:30.0000000Z')
check(
  'type marker is inert source text',
  byId(5)._type === 'Synthetic.Unresolvable.Type, NoSuchAssembly'
)
check(
  'binary and decimal values retain type',
  byId(5).BinaryProbe.$binary === 'AAF//w==' && byId(5).DecimalProbe.$numberDecimal === '12.345'
)
check(
  'action enums retain the source string encoding',
  byId(1).GameActions[0].Type === 'File' &&
    byId(2).GameActions[0].Type === 'URL' &&
    byId(3).GameActions[0].Type === 'Emulator' &&
    byId(4).GameActions[0].Type === 'Script'
)
check(
  'ROM and profile references survive',
  byId(3).Roms.length === 1 && byId(3).GameActions[0].EmulatorProfileId === 'synthetic-profile'
)
check('non-play action remains distinguishable', byId(4).GameActions[1].IsPlayAction === false)
check(
  'script text is decoded as data',
  byId(4).GameActions[0].Script === "Write-Output 'synthetic only'"
)
const archive = spawnSync(reader, [zipPath], {
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024
})
assert.equal(archive.status, 0, 'Synthetic archive decoding must succeed.')
const summary = JSON.parse(archive.stdout)
check('backslash ZIP names resolve', summary.databaseVersion === 4 && summary.games === 5)
check(
  'custom state and emulator collections decode',
  summary.databases['completionstatuses.db'].CompletionStatus === 4 &&
    summary.databases['emulators.db'].Emulator === 1
)
check(
  'managed image reference resolves and reads',
  summary.coverage.imageReferencesFound === 1 && summary.coverage.imageReferencesRead === 1
)
check(
  'category and tag collections retain references',
  summary.databases['categories.db'].Category === 1 &&
    summary.databases['tags.db'].Tag === 1 &&
    byId(1).CategoryIds[0].$guid.endsWith('301') &&
    byId(1).TagIds[0].$guid.endsWith('401')
)
check(
  'source input bytes are unchanged',
  before.database === hash(readFileSync(dbPath)) && before.archive === hash(readFileSync(zipPath))
)
console.log(
  JSON.stringify(
    {
      passed: tests.length,
      tests,
      before,
      readerBytes: statSync(reader).size,
      syntheticArchive: summary
    },
    null,
    2
  )
)
