import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { crc32 } from 'node:zlib'
import type Sharp = require('../../../../clients/desktop/app/node_modules/sharp')

const [fflateModule, readerInput] = process.argv.slice(2)
assert(fflateModule && readerInput, 'Pass the local fflate ESM module and Playnite reader exe.')
const reader = path.resolve(readerInput)
const archiveModule = path.resolve(fflateModule)
type ArchiveMembers = Record<string, Uint8Array>
const {
  unzipSync,
  zipSync,
}: {
  unzipSync(data: Uint8Array): ArchiveMembers
  zipSync(members: ArchiveMembers): Uint8Array
} = await import(pathToFileURL(archiveModule).href)
const require = createRequire(
  new URL('../../../../clients/desktop/app/package.json', import.meta.url),
)
const sharp: typeof Sharp.default = require('sharp')
const evidence = fileURLToPath(new URL('../', import.meta.url))
const calibre = path.join(evidence, 'calibre-importer/fixture/library/.calnotes')
const playnite = path.join(evidence, 'playnite-importer/synthetic-backup.zip')
const hash = (algorithm: string, data: Uint8Array) =>
  createHash(algorithm).update(data).digest('hex')
const pixels = Buffer.from([255, 0, 0, 255, 0, 0, 255, 128])
const goodImage = await sharp(pixels, { raw: { channels: 4, width: 2, height: 1 } })
  .png()
  .toBuffer()
const temp = await mkdtemp(path.join(tmpdir(), 'kisaki-importer-images-'))
const positiveArchive = path.join(temp, 'playnite-positive.zip')
const positiveNotes = path.join(temp, 'notes.db')
const positiveDigest = hash('sha1', goodImage)
const positiveStore = path.join(temp, 'resources', positiveDigest.slice(0, 2))
const positiveResource = path.join(positiveStore, 'sha1-' + positiveDigest)

async function readCalibreImage(library: string) {
  const db = new DatabaseSync(path.join(library, 'notes.db'), { readOnly: true })
  let row: Record<string, SQLOutputValue>
  try {
    const rows = db
      .prepare(`
      SELECT n.doc, r.hash FROM notes n
      JOIN notes_resources_link l ON l.note = n.id
      JOIN resources r ON r.hash = l.resource WHERE n.id = 1
    `)
      .all()
    assert.equal(rows.length, 1)
    row = rows[0]!
  } finally {
    db.close()
  }
  assert(typeof row.hash === 'string' && typeof row.doc === 'string')
  const [algorithm, digest] = row.hash.split(':')
  assert(algorithm === 'sha1' && digest)
  assert.match(digest, /^[0-9a-f]{40}$/)
  assert(row.doc.includes('calres://sha1/' + digest))
  const bytes = await readFile(
    path.join(library, 'resources', digest.slice(0, 2), 'sha1-' + digest),
  )
  assert.equal(hash(algorithm, bytes), digest)
  return bytes
}

async function checkImagePair(positive: Buffer, negative: Buffer) {
  assert.deepEqual(negative.subarray(0, 8), positive.subarray(0, 8))
  const idatChunk = (bytes: Buffer) => {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const end = offset + 8 + bytes.readUInt32BE(offset)
      assert(end + 4 <= bytes.length)
      const chunk = bytes.subarray(offset + 4, end)
      if (chunk.subarray(0, 4).toString() === 'IDAT') {
        return { expected: bytes.readUInt32BE(end), actual: crc32(chunk) }
      }
      offset = end + 4
    }
    assert.fail('The image fixture has no IDAT chunk.')
  }
  const badChunk = idatChunk(negative)
  assert.notEqual(badChunk.actual, badChunk.expected)
  const { data, info } = await sharp(positive, { failOn: 'warning' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  assert.deepEqual([info.width, info.height, info.channels], [2, 1, 4])
  assert.deepEqual(data, pixels)
  await assert.rejects(
    () => sharp(negative, { failOn: 'warning' }).raw().toBuffer(),
    /png.*(error|CRC)/i,
  )
  return { positive: hash('sha256', positive), negative: hash('sha256', negative) }
}

async function readPlayniteCover(archive: string, name: string) {
  const result = spawnSync(reader, [archive], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  })
  assert.equal(result.status, 0, 'Playnite research reader must read the synthetic archive.')
  const { coverage } = JSON.parse(result.stdout) as {
    coverage: {
      imageReferences: number
      imageReferencesFound: number
      imageReferencesRead: number
      imageBytesRead: number
    }
  }
  assert.equal(coverage.imageReferences, 1)
  assert.equal(coverage.imageReferencesFound, 1)
  assert.equal(coverage.imageReferencesRead, 1)
  const members = unzipSync(await readFile(archive))
  assert.deepEqual(
    Object.keys(members).filter((member) => member.startsWith('libraryfiles\\')),
    [name],
  )
  const bytes = members[name]!
  assert.equal(bytes.byteLength, coverage.imageBytesRead)
  return Buffer.from(bytes)
}

try {
  const negativeCalibre = await readCalibreImage(calibre)
  const negativeDigest = hash('sha1', negativeCalibre)
  await copyFile(path.join(calibre, 'notes.db'), positiveNotes)
  await mkdir(positiveStore, { recursive: true })
  await writeFile(positiveResource, goodImage)
  const db = new DatabaseSync(positiveNotes)
  try {
    db.prepare('UPDATE resources SET hash = ? WHERE hash = ?').run(
      'sha1:' + positiveDigest,
      'sha1:' + negativeDigest,
    )
    db.prepare('UPDATE notes_resources_link SET resource = ? WHERE note = 1 AND resource = ?').run(
      'sha1:' + positiveDigest,
      'sha1:' + negativeDigest,
    )
    db.prepare('UPDATE notes SET doc = replace(doc, ?, ?) WHERE id = 1').run(
      negativeDigest,
      positiveDigest,
    )
  } finally {
    db.close()
  }
  const calibreResult = await checkImagePair(await readCalibreImage(temp), negativeCalibre)

  const archiveMembers = unzipSync(await readFile(playnite))
  const coverMember = 'libraryfiles\\synthetic\\cover.png'
  const negativePlaynite = await readPlayniteCover(playnite, coverMember)
  archiveMembers[coverMember] = goodImage
  await writeFile(positiveArchive, zipSync(archiveMembers))
  const playniteResult = await checkImagePair(
    await readPlayniteCover(positiveArchive, coverMember),
    negativePlaynite,
  )

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        runtime: {
          platform: process.platform,
          arch: process.arch,
          node: process.version,
          sharp: sharp.versions.sharp,
          vips: sharp.versions.vips,
          fflateModuleSha256: hash('sha256', await readFile(archiveModule)),
          playniteReaderSha256: hash('sha256', await readFile(reader)),
        },
        passed: true,
        calibre: calibreResult,
        playnite: playniteResult,
        expected: {
          decoded: { dimensions: [2, 1], rgba: [...pixels] },
          rejected: 'invalid IDAT CRC',
        },
      },
      null,
      2,
    ),
  )
} finally {
  assert.equal(path.dirname(temp), path.resolve(tmpdir()))
  assert(path.basename(temp).startsWith('kisaki-importer-images-'))
  await rm(temp, { force: true, recursive: true })
}
