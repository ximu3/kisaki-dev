import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { gzipSync, inflateSync } from 'node:zlib'
import {
  directory,
  dependencies,
  loadSchema,
  sha256,
  categoryFor,
  mediaId,
  rating,
  state,
  position,
  asciiNaturalPages,
  resolveRelative
} from './proof.mjs'

if (!process.argv[2]) throw new Error('Pass the local fflate ESM module path.')
const { unzipSync } = await import(pathToFileURL(path.resolve(process.argv[2])).href)
const manifest = JSON.parse(
  await fs.readFile(path.join(directory, 'fixture-manifest.json'), 'utf8')
)
const sourceFields = JSON.parse(
  await fs.readFile(path.join(directory, 'source-fields.json'), 'utf8')
)
const fixtureRoot = path.join(directory, 'fixtures')
const before = await Promise.all(
  manifest.files.map(async (file) => ({
    ...file,
    actual: sha256(await fs.readFile(path.join(fixtureRoot, file.path)))
  }))
)
const { root, type, decode } = await loadSchema()
const currentBytes = await fs.readFile(path.join(fixtureRoot, 'current.tachibk'))
const current = decode(currentBytes)
const old = decode(await fs.readFile(path.join(fixtureRoot, 'tachiyomi.proto.gz')))
const tests = []
function check(name, run) {
  run()
  tests.push({ name, status: 'passed' })
}
const value = (name, actual, expected) => check(name, () => assert.deepEqual(actual, expected))
const rejects = (name, run) => check(name, () => assert.throws(run))

for (const model of sourceFields) {
  check(model.tag + ' ' + model.model + ' selected field numbers match pinned Kotlin', () => {
    const schema = root.lookupType('mihonproof.' + model.model)
    const aliases = { viewer_flags: 'viewerFlags' }
    for (const field of model.fields) {
      const selected = schema.fields[aliases[field.name] ?? field.name]
      if (selected) assert.equal(selected.id, field.number)
    }
  })
}
value(
  'Gzip and raw protobuf decode to the same records',
  decode(await fs.readFile(path.join(fixtureRoot, 'current.pb'))),
  current
)
value('Current backup has three synthetic manga', current.backupManga.length, 3)
value('Old backup has one synthetic manga', old.backupManga.length, 1)
value(
  'Maximum signed 64-bit source ID remains exact',
  current.backupManga[0].source,
  '9223372036854775807'
)
value(
  'Minimum signed 64-bit source ID remains exact',
  current.backupManga[2].source,
  '-9223372036854775808'
)
value('Local source ID remains zero', current.backupManga[1].source, '0')
value(
  'Omitted library-membership flag uses Kotlin true default',
  current.backupManga[0].favorite,
  true
)
value('Explicit false library-membership flag survives', current.backupManga[2].favorite, false)
value(
  'Library-only default excludes non-library read entries',
  current.backupManga.filter((manga) => manga.favorite).length,
  2
)
value('Omitted chapter read is false', current.backupManga[1].chapters[1].read, false)
value(
  'Markdown notes remain readable text',
  current.backupManga[0].notes.includes('**很喜欢这一章。**'),
  true
)
value('Old backup has no source Markdown note', old.backupManga[0].notes, '')
value(
  'Unknown optional preferences are absent from selected projection',
  JSON.stringify(current).includes('SYNTHETIC_PRIVATE_FIELD'),
  false
)
value(
  'Independent minimal wire example decodes local source',
  decode(Buffer.from('0a050800120178', 'hex')).backupManga[0].source,
  '0'
)
value(
  'Independent explicit-false wire example keeps false',
  decode(Buffer.from('0a080800120178a00600', 'hex')).backupManga[0].favorite,
  false
)
rejects('Required manga URL missing is rejected', () => decode(Buffer.from('0a020800', 'hex')))
rejects('Truncated protobuf is rejected', () => decode(Buffer.from('0a05080012', 'hex')))
const malformed = await fs.readFile(path.join(fixtureRoot, 'malformed.tachibk'))
rejects('Corrupt gzip checksum is rejected', () => decode(malformed))
const legacy = await fs.readFile(path.join(fixtureRoot, 'legacy.json'))
rejects('Legacy JSON is rejected', () => decode(legacy))
rejects('Empty input is rejected before writes', () => decode(Buffer.alloc(0)))
rejects('Expanded data has a bounded fixture budget', () =>
  decode(gzipSync(Buffer.alloc(9 * 1024 * 1024)))
)
value(
  'Category reference resolves by order rather than category ID',
  categoryFor(current, '7').name,
  '重读'
)
rejects('Category ID cannot stand in for unknown category order', () => categoryFor(current, '999'))
rejects('Duplicate category order is ambiguous', () =>
  categoryFor(
    { backupCategories: [current.backupCategories[0], { name: '冲突', order: '7' }] },
    '7'
  )
)
value(
  'Identical source display names retain distinct IDs',
  new Set(
    current.backupSources
      .filter((source) => source.name === '同名来源')
      .map((source) => source.sourceId)
  ).size,
  2
)
value(
  'Modern tracking media ID is distinct from library row ID',
  mediaId(current.backupManga[0].tracking[0]),
  '123'
)
value(
  'Legacy 32-bit media ID is adopted when present',
  mediaId(old.backupManga[0].tracking[0]),
  '789'
)
rejects('Conflicting old and new media IDs are rejected', () =>
  mediaId({ mediaIdInt: 3, mediaId: '4' })
)
rejects('Private library row ID cannot replace a missing media ID', () =>
  mediaId({ libraryId: '99', mediaIdInt: 0, mediaId: '0' })
)
value('MangaUpdates decimal ID conversion is exact', BigInt('23606352927').toString(36), 'auem2hr')
value('MAL eight of ten maps to eighty', rating(1, 8, 'mihon-0.21.2'), 80)
value(
  'AniList stores hundred-point score independent of display mode',
  rating(2, 85, 'mihon-0.21.2'),
  85
)
value('Old AniList also stores hundred-point score', rating(2, 85, 'tachiyomi-0.15.3'), 85)
value('Current Kitsu eight of twenty maps to forty', rating(3, 8, 'mihon-0.21.2'), 40)
value('Old Kitsu eight of ten maps to eighty', rating(3, 8, 'tachiyomi-0.15.3'), 80)
value('Current Kitsu minus-one sentinel is unrated', rating(3, -1, 'mihon-0.21.2'), null)
value('Zero tracker score is unrated', rating(1, 0, 'mihon-0.21.2'), null)
value(
  'Protobuf float rating keeps intended tenth-point value',
  rating(7, current.backupManga[0].tracking[3].score, 'mihon-0.21.2'),
  87
)
value(
  'Old MangaUpdates UI scale allowed a positive sub-one value',
  rating(7, 0.5, 'tachiyomi-0.15.3'),
  5
)
value('MangaBaka stores hundred-point score', rating(11, 85, 'mihon-0.21.2'), 85)
rejects('Unknown family cannot silently choose Kitsu scale', () => rating(3, 8, 'unknown'))
rejects('Current Kitsu out-of-range score is rejected', () => rating(3, 21, 'mihon-0.21.2'))
rejects('Non-finite tracker score is rejected', () => rating(1, Number.NaN, 'mihon-0.21.2'))
rejects('Self-hosted tracker has no personal rating scale', () => rating(6, 0, 'mihon-0.21.2'))
rejects('New tracker is not accepted under old source family', () =>
  rating(11, 85, 'tachiyomi-0.15.3')
)
value('MangaUpdates zero is a real reading-list status', state(7, 0), 'active')
value('Hikka zero is a real reading status', state(10, 0), 'active')
value('MAL dropped does not clear an existing current state', state(1, 4), 'unsupported')
value('AniList repeating is active and not completed', state(2, 6), 'active')
value('MangaBaka considering does not become planned', state(11, 7), 'unsupported')
value('Bangumi reading uses its own numeric status', state(5, 3), 'active')
value('Self-hosted chapter-total completion is not Work completion', state(6, 3), 'unsupported')
value('Unknown tracker status does not clear current state', state(2, 999), 'unsupported')
value(
  'Fractional source chapter number remains fractional',
  current.backupManga[0].chapters[2].chapterNumber,
  13.5
)
value(
  'Same chapter number does not collapse separate release URLs',
  new Set(current.backupManga[0].chapters.slice(0, 2).map((chapter) => chapter.url)).size,
  2
)
value(
  'Chapter bookmark is independent of its resume page',
  {
    marked: current.backupManga[0].chapters[0].bookmark,
    index: current.backupManga[0].chapters[0].lastPageRead
  },
  { marked: true, index: '1' }
)
value(
  'History preserves cumulative milliseconds without a session start',
  current.backupManga[0].history[0].readDuration,
  '5400000'
)
value(
  'Cleared last-read time can coexist with cumulative duration',
  current.backupManga[0].history[1],
  { url: '/chapter/13-5', lastRead: '0', readDuration: '1000' }
)
value(
  'Serialized history has no start/end activity interval',
  Object.keys(current.backupManga[0].history[0]).sort(),
  ['lastRead', 'readDuration', 'url']
)

const archive = unzipSync(await fs.readFile(path.join(fixtureRoot, 'local/本地作品/第1卷.cbz')))
const pngNames = Object.keys(archive).filter(
  (name) => Buffer.from(archive[name]).subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
)
value('Actual CBZ has three image members and excludes text file', pngNames.length, 3)
const natural = asciiNaturalPages(pngNames)
value('Local archive order is natural order', natural, ['1.png', '2.png', '10.png'])
const downloaded = (
  await fs.readdir(path.join(fixtureRoot, 'downloads/Source EN/星光日记/Group_Chapter 1'))
).sort()
value('Downloaded directory uses lexical filename order', downloaded, ['1.png', '10.png', '2.png'])
value(
  'Local zero-based page one resolves to member two',
  position(current.backupManga[1].chapters[0], natural).page.path,
  '2.png'
)
value(
  'Download zero-based page one resolves to member ten',
  position(current.backupManga[0].chapters[0], downloaded).page.path,
  '10.png'
)
value(
  'Default zero without reading observation creates no resume point',
  position({ lastPageRead: '0' }, natural),
  null
)
value(
  'Observed page zero is a valid first-page position',
  position({ lastPageRead: '0' }, natural, '1740873600000').page.path,
  '1.png'
)
rejects('Negative lastPageRead is rejected instead of clamped', () =>
  position({ lastPageRead: '-1' }, natural)
)
rejects('Unsafe 64-bit lastPageRead is not rounded into a page', () =>
  position(current.backupManga[0].chapters[2], natural)
)
rejects('Out-of-bounds lastPageRead is not clipped', () => position({ lastPageRead: '3' }, natural))
check('Synthetic PNG contains a valid one-pixel RGBA scanline', () => {
  const png = Buffer.from(archive['1.png'])
  const size = png.readUInt32BE(33)
  assert.deepEqual(inflateSync(png.subarray(41, 41 + size)), Buffer.from([0, 255, 255, 255, 255]))
})
value(
  'Local chapter path resolves within selected persistent root',
  resolveRelative(fixtureRoot, 'local/本地作品/第1卷.cbz'),
  path.join(fixtureRoot, 'local/本地作品/第1卷.cbz')
)
rejects('Parent path traversal is rejected', () => resolveRelative(fixtureRoot, '../outside.cbz'))
rejects('Android content URI is not a desktop file path', () =>
  resolveRelative(fixtureRoot, 'content://provider/book')
)
rejects('Absolute source path is not accepted as a relative member', () =>
  resolveRelative(fixtureRoot, 'C:/outside.cbz')
)

for (const file of before) {
  check('Source fixture remains unchanged: ' + file.path, () =>
    assert.equal(file.actual, file.sha256)
  )
  assert.equal(sha256(await fs.readFile(path.join(fixtureRoot, file.path))), file.sha256)
}
const result = {
  checkedAt: new Date().toISOString(),
  syntheticOnly: true,
  status: 'passed',
  total: tests.length,
  dependencies,
  limitations: [
    'No real user backup or Android/Kotlin serializer was run.',
    'Selected field and semantic probes are not a production importer or host acceptance.',
    'Page comparator probe covers simple ASCII numeric image names only.',
    'Opaque optional preference bytes test skipping, not preference deserialization.',
    'No source application, online extension, user media, or native Kisaki database was changed.'
  ],
  tests
}
await fs.writeFile(
  path.join(directory, 'synthetic-results.json'),
  JSON.stringify(result, null, 2) + '\n'
)
console.log(JSON.stringify({ status: result.status, passed: tests.length, syntheticOnly: true }))
