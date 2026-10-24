import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync, backup } from 'node:sqlite'
import { createHash } from 'node:crypto'

// Build source-shaped synthetic inputs; never read a user library.
const root = path.dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(await fs.readFile(path.join(root, 'fixture-data.json'), 'utf8'))
const zipModule = process.argv[2]
if (!zipModule) throw new Error('Provide the local fflate module path.')
const { zipSync, strToU8 } = await import(pathToFileURL(path.resolve(zipModule)).href)
const out = path.join(root, 'fixture')
const library = path.join(out, 'library')
await fs.mkdir(library, { recursive: true })
const db = new DatabaseSync(':memory:')
db.exec(
  'PRAGMA user_version=28; ' +
    [
      'CREATE TABLE books(id INTEGER PRIMARY KEY,title TEXT NOT NULL,sort TEXT,timestamp TIMESTAMP,pubdate TIMESTAMP,series_index REAL NOT NULL,author_sort TEXT,path TEXT NOT NULL,uuid TEXT,has_cover BOOL,last_modified TIMESTAMP)',
      'CREATE TABLE authors(id INTEGER PRIMARY KEY,name TEXT NOT NULL,sort TEXT,link TEXT)',
      'CREATE TABLE books_authors_link(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,author INTEGER NOT NULL,UNIQUE(book,author))',
      'CREATE TABLE ratings(id INTEGER PRIMARY KEY,rating INTEGER CHECK(rating > -1 AND rating < 11),link TEXT,UNIQUE(rating))',
      'CREATE TABLE books_ratings_link(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,rating INTEGER NOT NULL,UNIQUE(book,rating))',
      'CREATE TABLE series(id INTEGER PRIMARY KEY,name TEXT NOT NULL,sort TEXT,link TEXT)',
      'CREATE TABLE books_series_link(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,series INTEGER NOT NULL,UNIQUE(book))',
      'CREATE TABLE tags(id INTEGER PRIMARY KEY,name TEXT NOT NULL,link TEXT)',
      'CREATE TABLE books_tags_link(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,tag INTEGER NOT NULL,UNIQUE(book,tag))',
      'CREATE TABLE identifiers(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,type TEXT NOT NULL,val TEXT NOT NULL,UNIQUE(book,type))',
      'CREATE TABLE comments(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,text TEXT NOT NULL,UNIQUE(book))',
      'CREATE TABLE data(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,format TEXT NOT NULL,uncompressed_size INTEGER NOT NULL,name TEXT NOT NULL,UNIQUE(book,format))',
      'CREATE TABLE custom_columns(id INTEGER PRIMARY KEY,label TEXT NOT NULL,name TEXT NOT NULL,datatype TEXT NOT NULL,mark_for_delete BOOL NOT NULL DEFAULT 0,editable BOOL NOT NULL DEFAULT 1,display TEXT NOT NULL,is_multiple BOOL NOT NULL,normalized BOOL NOT NULL,UNIQUE(label))',
      'CREATE TABLE annotations(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,format TEXT NOT NULL,user_type TEXT NOT NULL,user TEXT NOT NULL,timestamp REAL NOT NULL,annot_id TEXT NOT NULL,annot_type TEXT NOT NULL,annot_data TEXT NOT NULL,searchable_text TEXT NOT NULL,UNIQUE(book,user_type,user,format,annot_type,annot_id))',
      'CREATE TABLE last_read_positions(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,format TEXT NOT NULL,user TEXT NOT NULL,device TEXT NOT NULL,cfi TEXT NOT NULL,epoch REAL NOT NULL,pos_frac REAL NOT NULL,UNIQUE(user,device,book,format))',
      'CREATE TABLE preferences(id INTEGER PRIMARY KEY,key TEXT NOT NULL,val TEXT NOT NULL,UNIQUE(key))'
    ].join(';')
)
db.prepare('INSERT INTO authors VALUES(1,?,?,?)').run('Synthetic Author', 'Author, Synthetic', '')
db.prepare('INSERT INTO tags VALUES(1,?,?)').run('夜读', '')
const seriesIds = new Map()
for (const book of data.books) {
  await fs.mkdir(path.join(library, book.path), { recursive: true })
  db.prepare('INSERT INTO books VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
    book.id,
    book.title,
    book.title,
    '2026-09-01T00:00:00+00:00',
    '2020-01-01T00:00:00+00:00',
    book.index,
    'Author, Synthetic',
    book.path,
    book.uuid,
    book.id === 1 ? 1 : 0,
    '2026-10-01T00:00:00+00:00'
  )
  db.prepare('INSERT INTO books_authors_link(book,author) VALUES(?,1)').run(book.id)
  if (book.rating !== null) {
    db.prepare('INSERT OR IGNORE INTO ratings(rating,link) VALUES(?,?)').run(book.rating, '')
    db.prepare(
      'INSERT INTO books_ratings_link(book,rating) SELECT ?,id FROM ratings WHERE rating=?'
    ).run(book.id, book.rating)
  }
  if (book.isbn)
    db.prepare('INSERT INTO identifiers(book,type,val) VALUES(?,?,?)').run(
      book.id,
      'isbn',
      book.isbn
    )
  if (book.series) {
    if (!seriesIds.has(book.series)) {
      const id = seriesIds.size + 1
      seriesIds.set(book.series, id)
      db.prepare('INSERT INTO series VALUES(?,?,?,?)').run(id, book.series, book.series, '')
    }
    db.prepare('INSERT INTO books_series_link(book,series) VALUES(?,?)').run(
      book.id,
      seriesIds.get(book.series)
    )
  }
}
db.prepare('INSERT INTO comments(book,text) VALUES(1,?)').run(
  '<p>这是合成书目简介，不是用户书评。</p>'
)
db.prepare('INSERT INTO books_tags_link(book,tag) VALUES(1,1)').run()
db.prepare('INSERT INTO preferences(key,val) VALUES(?,?)').run(
  'user_categories',
  JSON.stringify(data.userCategories)
)
for (const column of data.columns) {
  db.prepare(
    'INSERT INTO custom_columns(id,label,name,datatype,display,is_multiple,normalized) VALUES(?,?,?,?,?,?,?)'
  ).run(
    column.id,
    column.label,
    column.name,
    column.datatype,
    JSON.stringify(column.display ?? {}),
    Number(Boolean(column.is_multiple)),
    Number(column.normalized)
  )
  const table = 'custom_column_' + column.id
  if (column.normalized) {
    db.exec(
      'CREATE TABLE ' +
        table +
        '(id INTEGER PRIMARY KEY,value TEXT NOT NULL,link TEXT NOT NULL DEFAULT ' +
        "''" +
        ',UNIQUE(value));CREATE TABLE books_' +
        table +
        '_link(id INTEGER PRIMARY KEY,book INTEGER NOT NULL,value INTEGER NOT NULL,UNIQUE(book,value))'
    )
    for (const [book, value] of column.values) {
      db.prepare('INSERT OR IGNORE INTO ' + table + '(value) VALUES(?)').run(value)
      db.prepare(
        'INSERT INTO books_' +
          table +
          '_link(book,value) SELECT ?,id FROM ' +
          table +
          ' WHERE value=?'
      ).run(book, value)
    }
  } else {
    const sqlType = { bool: 'BOOL', int: 'INT', datetime: 'TIMESTAMP' }[column.datatype] ?? 'TEXT'
    db.exec(
      'CREATE TABLE ' +
        table +
        '(id INTEGER PRIMARY KEY,book INTEGER,value ' +
        sqlType +
        ' NOT NULL,UNIQUE(book))'
    )
    for (const [book, value] of column.values)
      db.prepare('INSERT INTO ' + table + '(book,value) VALUES(?,?)').run(book, value)
  }
}
for (const item of data.annotations) {
  const a = item.annotation
  db.prepare(
    'INSERT INTO annotations(book,format,user_type,user,timestamp,annot_id,annot_type,annot_data,searchable_text) VALUES(?,?,?,?,?,?,?,?,?)'
  ).run(
    item.book,
    item.format,
    item.user_type,
    item.user,
    Date.parse(a.timestamp) / 1000,
    a.uuid ?? a.title,
    a.type,
    JSON.stringify(a),
    a.highlighted_text ?? a.title ?? ''
  )
}
for (const p of data.lastPositions)
  db.prepare(
    'INSERT INTO last_read_positions(book,format,user,device,cfi,epoch,pos_frac) VALUES(?,?,?,?,?,?,?)'
  ).run(p.book, p.format, p.user, p.device, p.cfi, p.epoch, p.pos_frac)
const packageXml =
  '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book">urn:uuid:' +
  data.books[0].uuid +
  '</dc:identifier><dc:title>星屑庭院</dc:title><dc:language>zh</dc:language></metadata><manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'
const xhtml =
  '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head><body><p id="p1">星光与庭院。😀第二句。</p><p id="p2">第二段。</p></body></html>'
const epub = zipSync({
  mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  'META-INF/container.xml': strToU8(
    '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  ),
  'OEBPS/content.opf': strToU8(packageXml),
  'OEBPS/ch1.xhtml': strToU8(xhtml)
})
const base = path.join(library, data.books[0].path, 'Stardust Garden')
await fs.writeFile(base + '.epub', epub)
await fs.writeFile(
  path.join(library, data.books[0].path, 'cover.jpg'),
  Buffer.from(data.jpegBase64, 'base64')
)
for (const [book, format, size, name] of [
  [1, 'EPUB', epub.length, 'Stardust Garden'],
  [1, 'PDF', 2048, 'Stardust Garden'],
  [2, 'MOBI', 1024, 'Moon Boat']
])
  db.prepare('INSERT INTO data(book,format,uncompressed_size,name) VALUES(?,?,?,?)').run(
    book,
    format,
    size,
    name
  )
await backup(db, path.join(library, 'metadata.db'))
db.close()
const png = Buffer.from(data.pngBase64, 'base64')
const digest = createHash('sha1').update(png).digest('hex')
const resourceHash = 'sha1:' + digest
const notesDir = path.join(library, '.calnotes')
const resourceDir = path.join(notesDir, 'resources', digest.slice(0, 2))
await fs.mkdir(resourceDir, { recursive: true })
await fs.writeFile(path.join(resourceDir, 'sha1-' + digest), png)
const notesDb = new DatabaseSync(':memory:')
notesDb.exec(
  'PRAGMA user_version=1;CREATE TABLE notes(id INTEGER PRIMARY KEY,item INTEGER NOT NULL,colname TEXT NOT NULL,doc TEXT NOT NULL,searchable_text TEXT NOT NULL,ctime REAL,mtime REAL,UNIQUE(item,colname));CREATE TABLE resources(hash TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE) WITHOUT ROWID;CREATE TABLE notes_resources_link(id INTEGER PRIMARY KEY,note INTEGER NOT NULL,resource TEXT NOT NULL,UNIQUE(note,resource))'
)
notesDb
  .prepare('INSERT INTO notes VALUES(1,1,?,?,?,?,?)')
  .run(
    'authors',
    '<p>合成作者资料笔记。</p><img src="calres://sha1/' + digest + '">',
    '合成作者资料笔记。',
    1790848800,
    1790848800
  )
notesDb
  .prepare('INSERT INTO notes VALUES(2,1,?,?,?,?,?)')
  .run('tags', '<p>夜读分类说明。</p>', '夜读分类说明。', 1790848800, 1790848800)
notesDb.prepare('INSERT INTO resources VALUES(?,?)').run(resourceHash, 'synthetic-pixel.png')
notesDb.prepare('INSERT INTO notes_resources_link VALUES(1,1,?)').run(resourceHash)
await backup(notesDb, path.join(notesDir, 'notes.db'))
notesDb.close()
const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
const meta = (name, value) => '<meta name="' + esc(name) + '" content="' + esc(value) + '"/>'
const opfValue = (c) => {
  const value = c.values.find((x) => x[0] === 1)?.[1] ?? null
  if (c.is_multiple) return c.values.filter((x) => x[0] === 1).map((x) => x[1])
  if (c.datatype === 'bool' && value !== null) return Boolean(value)
  if (c.datatype === 'datetime' && value !== null)
    return { __class__: 'datetime.datetime', __value__: new Date(value).toISOString() }
  return value
}
const userMetadata = data.columns
  .map((c) =>
    meta(
      'calibre:user_metadata:#' + c.label,
      JSON.stringify({
        label: c.label,
        name: c.name,
        datatype: c.datatype,
        is_multiple: c.is_multiple ? '|' : null,
        is_multiple2: c.is_multiple
          ? {
              cache_to_list: '|',
              ui_to_list: c.display?.is_names ? '&' : ',',
              list_to_ui: c.display?.is_names ? ' & ' : ', '
            }
          : {},
        display: c.display ?? {},
        '#value#': opfValue(c)
      })
    )
  )
  .join('')
const annotations = data.annotations
  .filter((x) => x.book === 1)
  .map(({ book, ...x }) => meta('calibre:annotation', JSON.stringify(x)))
  .join('')
const opf = (cover, withAnnotations) =>
  '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid_id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"><dc:identifier opf:scheme="calibre" id="calibre_id">1</dc:identifier><dc:identifier opf:scheme="uuid" id="uuid_id">' +
  data.books[0].uuid +
  '</dc:identifier><dc:identifier opf:scheme="ISBN">9780306406157</dc:identifier><dc:title>星屑庭院</dc:title><dc:creator opf:role="aut">Synthetic Author</dc:creator><dc:description>&lt;p&gt;合成书目简介。&lt;/p&gt;</dc:description>' +
  meta('calibre:rating', '7') +
  meta('calibre:series', '独立作品选') +
  meta('calibre:series_index', '1') +
  userMetadata +
  (withAnnotations ? annotations : '') +
  '</metadata><guide><reference type="cover" title="Cover" href="' +
  cover +
  '"/></guide></package>'
await fs.writeFile(path.join(library, data.books[0].path, 'metadata.opf'), opf('cover.jpg', true))
const exported = path.join(out, 'export')
await fs.mkdir(exported, { recursive: true })
await fs.writeFile(path.join(exported, 'Stardust Garden.opf'), opf('Stardust Garden.jpg', false))
await fs.writeFile(path.join(exported, 'Stardust Garden.epub'), epub)
await fs.writeFile(
  path.join(exported, 'Stardust Garden.jpg'),
  Buffer.from(data.jpegBase64, 'base64')
)
await fs.writeFile(
  path.join(out, 'manifest.json'),
  JSON.stringify(
    {
      source: 'synthetic',
      books: data.books.length,
      metadataSchemaVersion: 28,
      notesSchemaVersion: 1,
      annotations: data.annotations.length,
      resourceHash,
      epubMembers: ['mimetype', 'META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/ch1.xhtml'],
      omitted: 'FTS, triggers and unrelated source tables are outside this schema subset.'
    },
    null,
    2
  ) + '\n'
)
console.log(
  JSON.stringify({
    created: 'synthetic calibre library and OPF export',
    books: data.books.length,
    annotations: data.annotations.length
  })
)
