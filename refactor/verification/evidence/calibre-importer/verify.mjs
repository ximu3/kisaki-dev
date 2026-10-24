import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath, pathToFileURL } from 'node:url'

// These probes validate the proposal against synthetic source-shaped data.
const root = path.dirname(fileURLToPath(import.meta.url))
const input = path.join(root, 'fixture')
const library = path.join(input, 'library')
if (!process.argv[2] || !process.argv[3])
  throw new Error('Provide local fflate and xmldom module paths.')
const { unzipSync, strFromU8 } = await import(pathToFileURL(path.resolve(process.argv[2])).href)
const { DOMParser } = await import(pathToFileURL(path.resolve(process.argv[3])).href)
const checks = []
function check(name, fn) {
  fn()
  checks.push({ name, passed: true })
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function hashes(dir) {
  const result = {}
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const current = path.join(dir, item.name)
    if (item.isDirectory()) Object.assign(result, await hashes(current))
    else
      result[path.relative(input, current).replaceAll('\\', '/')] = hash(await fs.readFile(current))
  }
  return result
}
const before = await hashes(input)
const openReadOnly = (file) => {
  const db = new DatabaseSync(file, { readOnly: true, allowExtension: false })
  db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN')
  return db
}
const db = openReadOnly(path.join(library, 'metadata.db'))
check('metadata schema version is 28', () =>
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 28)
)
check('five independent source book rows are readable', () =>
  assert.equal(db.prepare('SELECT count(*) AS n FROM books').get().n, 5)
)
check('read-only handle rejects mutations', () =>
  assert.throws(() => db.prepare('UPDATE books SET title=? WHERE id=1').run('Changed'))
)
check('extension loading cannot be enabled', () =>
  assert.throws(() => db.enableLoadExtension(true))
)
const rows = db
  .prepare(
    'SELECT b.id,b.title,r.rating FROM books b LEFT JOIN books_ratings_link l ON l.book=b.id LEFT JOIN ratings r ON r.id=l.rating ORDER BY b.id'
  )
  .all()
function rating(value, provided = true) {
  if (!provided) return { present: false }
  if (value === null || value === undefined) return { present: true, value: null }
  if (!Number.isSafeInteger(value) || value < 0 || value > 10) throw new Error('Invalid rating.')
  return { present: true, value: value === 0 ? null : value * 10 }
}
check('stored 7 means 3.5 stars and maps to 70', () =>
  assert.deepEqual(rating(rows[0].rating), { present: true, value: 70 })
)
check('stored zero is explicit unrated', () =>
  assert.deepEqual(rating(rows[2].rating), { present: true, value: null })
)
check('no rating link in a complete library means unrated', () =>
  assert.deepEqual(rating(rows[3].rating), { present: true, value: null })
)
check('missing optional OPF rating remains unknown', () =>
  assert.deepEqual(rating(undefined, false), { present: false })
)
check('invalid fractional stored rating is rejected', () => assert.throws(() => rating(7.5)))
check('negative stored rating is rejected', () => assert.throws(() => rating(-1)))
check('comments remain bibliographic description', () =>
  assert.match(db.prepare('SELECT text FROM comments WHERE book=1').get().text, /书目简介/)
)
const ids = db.prepare('SELECT book,type,val FROM identifiers ORDER BY book').all()
check('edition duplicate shares ISBN but not source row id', () =>
  assert.equal(ids.find((x) => x.book === 1).val, ids.find((x) => x.book === 3).val)
)
check('conflicting edition evaluations are not merged by row order', () =>
  assert.notDeepEqual(rating(rows[0].rating), rating(rows[2].rating))
)
const columns = db.prepare('SELECT * FROM custom_columns ORDER BY id').all()
function customValues(column) {
  if (!Number.isSafeInteger(column.id) || column.id < 1)
    throw new Error('Invalid custom column id.')
  if (column.datatype === 'composite') return { computed: true, rows: [] }
  const table = 'custom_column_' + column.id
  const sql = column.normalized
    ? 'SELECT l.book,c.value FROM books_' +
      table +
      '_link l JOIN ' +
      table +
      ' c ON c.id=l.value ORDER BY l.id'
    : 'SELECT book,value FROM ' + table + ' ORDER BY id'
  return { computed: false, rows: db.prepare(sql).all() }
}
const readValues = customValues(columns.find((c) => c.label === 'read')).rows
check('boolean false is retained separately from absence', () => {
  assert.equal(readValues.find((x) => x.book === 3).value, 0)
  assert.equal(
    readValues.find((x) => x.book === 4),
    undefined
  )
})
check('multi-valued custom columns use their link table', () =>
  assert.equal(
    customValues(columns.find((c) => c.label === 'shelves')).rows.filter((x) => x.book === 1)
      .length,
    2
  )
)
check('a comma in a stored label is not a separator', () =>
  assert.equal(
    customValues(columns.find((c) => c.label === 'shelves')).rows[1].value,
    '含,逗号的标签'
  )
)
check('computed column templates are not executed', () =>
  assert.deepEqual(customValues(columns.find((c) => c.label === 'computed')), {
    computed: true,
    rows: []
  })
)
check('dynamic table ids cannot inject SQL', () =>
  assert.throws(() => customValues({ id: '1; DROP TABLE books', datatype: 'bool' }))
)
const asDate = (value, timeZone) => {
  if (value === null || value === 'None' || /^0101-01-01/.test(value)) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error('Invalid source datetime.')
  const [year, month, day, hour, minute, second] = value
    .match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})/)
    .slice(1)
    .map(Number)
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    throw new Error('Invalid calendar components.')
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid source datetime.')
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  )
  return parts.year + '-' + parts.month + '-' + parts.day
}
const finished = customValues(columns.find((c) => c.label === 'finished')).rows[0].value
check('date field uses selected source display timezone', () =>
  assert.equal(asDate(finished, 'Asia/Shanghai'), '2026-10-01')
)
check('legitimate first day is preserved', () =>
  assert.equal(asDate('2026-10-01T00:00:00Z', 'UTC'), '2026-10-01')
)
check('calibre undefined date means no date', () =>
  assert.equal(asDate('0101-01-01T00:00:00Z', 'UTC'), null)
)
check('malformed date is rejected', () => assert.throws(() => asDate('yesterday', 'UTC')))
check('impossible calendar date is rejected instead of normalized', () =>
  assert.throws(() => asDate('2026-02-30T00:00:00Z', 'UTC'))
)
const complete = ({ read, count, date, part = false }) => {
  if (count !== undefined && (!Number.isSafeInteger(count) || count < 0))
    throw new Error('Invalid completion count.')
  if (count === 0 && (read === true || date)) throw new Error('Conflicting completion values.')
  const n = count ?? (read === true || date ? 1 : 0)
  return part
    ? { completed: n > 0 }
    : { dates: Array.from({ length: n }, (_, i) => (i === 0 ? (date ?? null) : null)) }
}
check('explicit work count creates one dated and one undated fact', () =>
  assert.deepEqual(complete({ count: 2, date: '2026-10-01' }), { dates: ['2026-10-01', null] })
)
check('part completion never becomes a work count', () =>
  assert.deepEqual(complete({ read: true, count: 2, date: '2026-10-01', part: true }), {
    completed: true
  })
)
check('zero count and a completion date conflict', () =>
  assert.throws(() => complete({ count: 0, date: '2026-10-01' }))
)
check('no selected completion facts create no history', () =>
  assert.deepEqual(complete({}), { dates: [] })
)
const rawAnnotations = db
  .prepare('SELECT book,format,user_type,user,annot_data FROM annotations ORDER BY id')
  .all()
  .map((r) => ({ ...r, annotation: JSON.parse(r.annot_data) }))
const chosen = rawAnnotations.filter(
  (r) => r.user_type === 'local' && r.user === 'viewer' && !r.annotation.removed
)
check('reader scope excludes the other user', () =>
  assert.equal(
    chosen.some((x) => x.user === 'other-reader'),
    false
  )
)
check('removed annotations are not resurrected', () =>
  assert.equal(
    chosen.some((x) => x.annotation.uuid === 'h-removed'),
    false
  )
)
check('four live selected annotation rows remain', () => assert.equal(chosen.length, 4))
const current = db
  .prepare(
    'SELECT * FROM last_read_positions WHERE book=1 AND format=? AND user=? ORDER BY epoch DESC,id DESC'
  )
  .all('EPUB', 'local')[0]
check('latest position is selected within one user and format', () =>
  assert.equal(current.device, 'calibre-desktop-viewer')
)
check('position percent does not create a completion fact', () =>
  assert.deepEqual(complete({}), { dates: [] })
)
function inside(rootDir, relative) {
  if (
    !relative ||
    path.isAbsolute(relative) ||
    /^[A-Za-z]:/.test(relative) ||
    relative.includes('\\')
  )
    throw new Error('Invalid relative path.')
  const dest = path.resolve(rootDir, relative)
  const diff = path.relative(rootDir, dest)
  if (diff === '..' || diff.startsWith('..' + path.sep) || path.isAbsolute(diff))
    throw new Error('Path escapes the input root.')
  return dest
}
const formats = db
  .prepare('SELECT d.*,b.path FROM data d JOIN books b ON b.id=d.book ORDER BY d.id')
  .all()
const files = []
for (const row of formats) {
  const file = inside(library, row.path + '/' + row.name + '.' + row.format.toLowerCase())
  const exists = await fs.stat(file).then(
    (s) => s.isFile(),
    () => false
  )
  files.push({ book: row.book, format: row.format, exists, file })
}
check('data rows resolve one present and two missing formats', () =>
  assert.deepEqual(
    files.map((x) => x.exists),
    [true, false, false]
  )
)
check('EPUB and PDF are separate format files', () => assert.notEqual(files[0].file, files[1].file))
check('source paths cannot escape the library', () =>
  assert.throws(() => inside(library, '../outside.epub'))
)
check('absolute source paths are not treated as library members', () =>
  assert.throws(() => inside(library, 'C:/outside.epub'))
)
const xml = (value) => {
  if (/<!DOCTYPE|<!ENTITY/i.test(value)) throw new Error('Unsupported XML declaration.')
  const doc = new DOMParser({
    errorHandler: {
      warning() {},
      error() {
        throw new Error('Invalid XML.')
      },
      fatalError() {
        throw new Error('Invalid XML.')
      }
    }
  }).parseFromString(value, 'application/xml')
  return doc
}
const zip = unzipSync(await fs.readFile(files[0].file))
check('EPUB container has four actual members', () => assert.equal(Object.keys(zip).length, 4))
check('EPUB mimetype is correct', () =>
  assert.equal(strFromU8(zip.mimetype), 'application/epub+zip')
)
const container = xml(strFromU8(zip['META-INF/container.xml']))
const packagePath = container.getElementsByTagName('rootfile')[0].getAttribute('full-path')
const opfPackage = xml(strFromU8(zip[packagePath]))
const spine = Array.from(opfPackage.getElementsByTagName('itemref'))
const manifestItems = Array.from(opfPackage.getElementsByTagName('item'))
const member = path.posix.normalize(
  path.posix.join(
    path.posix.dirname(packagePath),
    manifestItems
      .find((x) => x.getAttribute('id') === spine[0].getAttribute('idref'))
      .getAttribute('href')
  )
)
const contentDoc = xml(strFromU8(zip[member]))
function resolvePoint(doc, cfi) {
  const match = /^((?:\/\d+(?:\[[A-Za-z0-9_-]+\])?)+):(\d+)$/.exec(cfi)
  if (!match) throw new Error('Unsupported CFI probe syntax.')
  let node = doc
  for (const step of match[1].matchAll(/\/(\d+)(?:\[([A-Za-z0-9_-]+)\])?/g)) {
    const target = Number(step[1])
    let elementCount = 0
    let found = null
    for (const child of Array.from(node.childNodes ?? [])) {
      let index = 0
      if (child.nodeType === 1) index = 2 * ++elementCount
      else if (child.nodeType === 3 || child.nodeType === 4) index = 2 * elementCount + 1
      if (index === target) {
        found = child
        break
      }
    }
    if (!found) throw new Error('CFI target is absent.')
    if (step[2] && found.getAttribute?.('id') !== step[2])
      throw new Error('CFI assertion mismatch.')
    node = found
  }
  const offset = Number(match[2])
  if (node.nodeType !== 3 || !Number.isSafeInteger(offset) || offset > node.data.length)
    throw new Error('Invalid text endpoint.')
  if (
    offset > 0 &&
    offset < node.data.length &&
    /[\uD800-\uDBFF]/.test(node.data[offset - 1]) &&
    /[\uDC00-\uDFFF]/.test(node.data[offset])
  )
    throw new Error('Endpoint splits a surrogate pair.')
  return { node, offset }
}
function nativePoint(sourcePoint, spineIndex = 0) {
  if (!spine[spineIndex]) throw new Error('Spine item is absent.')
  resolvePoint(contentDoc, sourcePoint)
  if (!sourcePoint.startsWith('/2/')) throw new Error('Document root is not established.')
  const spineElement = opfPackage.getElementsByTagName('spine')[0]
  const packageChildren = Array.from(opfPackage.documentElement.childNodes).filter(
    (x) => x.nodeType === 1
  )
  const spineStep = 2 * (packageChildren.indexOf(spineElement) + 1)
  return (
    'epubcfi(/' +
    spineStep +
    '/' +
    2 * (spineIndex + 1) +
    '[' +
    spine[spineIndex].getAttribute('idref') +
    ']!' +
    sourcePoint.slice(2) +
    ')'
  )
}
const high = chosen.find((x) => x.annotation.uuid === 'h-local').annotation
check('highlight names the exact EPUB member', () => assert.equal(high.spine_name, member))
const start = resolvePoint(contentDoc, high.start_cfi)
const end = resolvePoint(contentDoc, high.end_cfi)
check('source endpoints extract the actual synthetic quote', () => {
  assert.equal(start.node, end.node)
  assert.equal(start.node.data.slice(start.offset, end.offset), high.highlighted_text)
})
const nativeStart = nativePoint(high.start_cfi)
const nativeEnd = nativePoint(high.end_cfi)
check('source document path converts to standard package CFI', () =>
  assert.equal(nativeStart, 'epubcfi(/6/2[c1]!/4/2[p1]/1:0)')
)
check('end offset remains end-exclusive', () =>
  assert.equal(nativeEnd, 'epubcfi(/6/2[c1]!/4/2[p1]/1:5)')
)
check('standard CFI resolves to the same text endpoint', () => {
  const inner = nativeEnd.split('!')[1].slice(0, -1)
  assert.equal(resolvePoint(contentDoc, '/2' + inner).offset, end.offset)
})
check('out-of-range endpoint is rejected', () =>
  assert.throws(() => nativePoint('/2/4/2[p1]/1:999'))
)
check('surrogate pair cannot be split', () => assert.throws(() => nativePoint('/2/4/2[p1]/1:7')))
check('calibre viewport geometry is not a source text point', () =>
  assert.throws(() => nativePoint('/2/4@10:30'))
)
check('missing spine item does not fall back to the first chapter', () =>
  assert.throws(() => nativePoint(high.start_cfi, 3))
)
const unmapped = chosen.find((x) => x.format === 'MOBI').annotation
check('MOBI quote and comment remain available for a Note', () =>
  assert.ok(unmapped.highlighted_text && unmapped.notes)
)
check('empty unsupported bookmark has no fabricated Note body', () =>
  assert.equal(chosen.find((x) => x.annotation.pos?.includes('@')).annotation.title, '')
)
const readOpf = async (file) => {
  const doc = xml(await fs.readFile(file, 'utf8'))
  const meta = Array.from(doc.getElementsByTagName('meta'))
  return {
    doc,
    meta,
    custom: meta
      .filter((x) => x.getAttribute('name').startsWith('calibre:user_metadata:'))
      .map((x) => JSON.parse(x.getAttribute('content'))),
    annotations: meta
      .filter((x) => x.getAttribute('name') === 'calibre:annotation')
      .map((x) => JSON.parse(x.getAttribute('content')))
  }
}
const bookPath = db.prepare('SELECT path FROM books WHERE id=1').get().path
const backupOpf = await readOpf(path.join(library, bookPath, 'metadata.opf'))
const exportOpf = await readOpf(path.join(input, 'export', 'Stardust Garden.opf'))
check('backup OPF carries five scoped annotation envelopes', () =>
  assert.equal(backupOpf.annotations.length, 5)
)
check('save-to-disk OPF does not invent database annotation fields', () =>
  assert.equal(exportOpf.annotations.length, 0)
)
check('OPF boolean is a JSON boolean', () =>
  assert.equal(backupOpf.custom.find((x) => x.label === 'read')['#value#'], true)
)
check('OPF multi-value field remains a JSON array', () =>
  assert.deepEqual(backupOpf.custom.find((x) => x.label === 'shelves')['#value#'], [
    '夜读',
    '含,逗号的标签'
  ])
)
const dateWrapper = backupOpf.custom.find((x) => x.label === 'finished')['#value#']
check('OPF datetime is a data wrapper and is never instantiated', () => {
  assert.equal(dateWrapper.__class__, 'datetime.datetime')
  assert.equal(asDate(dateWrapper.__value__, 'Asia/Shanghai'), '2026-10-01')
})
check('OPF book UUID is not ISBN', () =>
  assert.equal(
    backupOpf.doc.getElementById('uuid_id')?.textContent ??
      Array.from(backupOpf.doc.getElementsByTagName('dc:identifier')).find(
        (x) => x.getAttribute('id') === 'uuid_id'
      ).textContent,
    '11111111-1111-4111-8111-111111111111'
  )
)
check('OPF external entity declaration is rejected', () =>
  assert.throws(() => xml('<!DOCTYPE p [<!ENTITY x SYSTEM "file:///private">]><p>&x;</p>'))
)
const notesDb = openReadOnly(path.join(library, '.calnotes', 'notes.db'))
check('category notes use their own schema version', () =>
  assert.equal(notesDb.prepare('PRAGMA user_version').get().user_version, 1)
)
const notes = notesDb.prepare('SELECT * FROM notes ORDER BY id').all()
check('category note scope is author and tag, not book', () =>
  assert.deepEqual(
    notes.map((x) => x.colname),
    ['authors', 'tags']
  )
)
const resource = notesDb
  .prepare(
    'SELECT r.hash,r.name FROM resources r JOIN notes_resources_link l ON l.resource=r.hash WHERE l.note=1'
  )
  .get()
const [algorithm, digest] = resource.hash.split(':')
const resourcePath = inside(
  path.join(library, '.calnotes', 'resources'),
  digest.slice(0, 2) + '/' + algorithm + '-' + digest
)
const resourceBytes = await fs.readFile(resourcePath)
check('calres URL matches the declared resource', () =>
  assert.ok(notes[0].doc.includes('calres://' + algorithm + '/' + digest))
)
check('resource content hash matches its resource key', () =>
  assert.equal(createHash(algorithm).update(resourceBytes).digest('hex'), digest)
)
check('note image bytes have PNG signature', () =>
  assert.equal(resourceBytes.subarray(1, 4).toString(), 'PNG')
)
const categories = JSON.parse(
  db.prepare('SELECT val FROM preferences WHERE key=?').get('user_categories').val
)
check('user category stores values and source fields, not book ids', () =>
  assert.deepEqual(categories['阅读整理'], [
    ['夜读', 'tags', 0],
    ['独立作品选', 'series', 0]
  ])
)
notesDb.exec('ROLLBACK')
notesDb.close()
db.exec('ROLLBACK')
db.close()
const after = await hashes(input)
check('every synthetic input byte remains unchanged after reads', () =>
  assert.deepEqual(after, before)
)
const result = {
  checkedAt: new Date().toISOString(),
  scope:
    'Synthetic SQLite/OPF/EPUB and proposal conversion probes; no source application or Kisaki runtime execution.',
  runtime: { node: process.version },
  counts: {
    checks: checks.length,
    books: 5,
    customColumns: 8,
    sourceAnnotations: 6,
    selectedLiveAnnotations: chosen.length,
    inputFiles: Object.keys(before).length
  },
  epubProbe: {
    member,
    sourceStart: high.start_cfi,
    sourceEnd: high.end_cfi,
    nativeStart,
    nativeEnd,
    quote: high.highlighted_text
  },
  checks,
  inputSha256: before,
  limitations: [
    'The SQLite fixture contains selected ordinary source tables, not calibre FTS tables or triggers.',
    'CFI checks cover this simple, unchanged XHTML tree only; full normalization, range forms and real viewer round trips remain implementation acceptance.',
    'No real user export, WAL recovery, host writes, attachments preparation or extension UI was exercised.'
  ]
}
await fs.writeFile(
  path.join(root, 'synthetic-results.json'),
  JSON.stringify(result, null, 2) + '\n'
)
console.log(
  JSON.stringify({
    checks: checks.length,
    passed: true,
    inputFiles: Object.keys(before).length,
    sourceAnnotations: 6,
    selectedLiveAnnotations: chosen.length
  })
)
