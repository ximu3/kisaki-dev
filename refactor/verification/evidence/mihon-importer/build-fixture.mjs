import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync, deflateSync } from 'node:zlib'
import { directory, loadSchema, sha256 } from './proof.mjs'

if (!process.argv[2]) throw new Error('Pass the local fflate ESM module path.')
const { zipSync } = await import(pathToFileURL(path.resolve(process.argv[2])).href)
const { type, protobuf } = await loadSchema()
const data = JSON.parse(await fs.readFile(path.join(directory, 'fixture-data.json'), 'utf8'))
const fixtureRoot = path.join(directory, 'fixtures')
const files = []
async function write(relative, content) {
  const target = path.resolve(fixtureRoot, relative)
  const resolved = path.relative(fixtureRoot, target)
  if (!resolved || resolved.startsWith('..') || path.isAbsolute(resolved))
    throw new Error('Invalid fixture destination.')
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content)
  files.push({
    path: relative.replaceAll('\\', '/'),
    bytes: content.length,
    sha256: sha256(content)
  })
}

const payload = type.encode(type.fromObject(data.current)).finish()
// The opaque optional field tests skipping; it is not a Kotlin preference serializer fixture.
const opaque = protobuf.Writer.create()
  .uint32((104 << 3) | 2)
  .bytes(Buffer.from('SYNTHETIC_PRIVATE_FIELD'))
  .finish()
const current = Buffer.concat([payload, opaque])
const compressed = gzipSync(current, { level: 6 })
await write('current.pb', current)
await write('current.tachibk', compressed)
await write('tachiyomi.proto.gz', gzipSync(type.encode(type.fromObject(data.old)).finish()))
const corrupt = Buffer.from(compressed)
corrupt[corrupt.length - 8] ^= 1
await write('malformed.tachibk', corrupt)
await write('legacy.json', Buffer.from('{"manga":[]}\n'))

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(name, content) {
  const typeBytes = Buffer.from(name)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(content.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, content])))
  return Buffer.concat([length, typeBytes, content, checksum])
}
const header = Buffer.alloc(13)
header.writeUInt32BE(1, 0)
header.writeUInt32BE(1, 4)
header[8] = 8
header[9] = 6
const png = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
  chunk('IEND', Buffer.alloc(0))
])
const entries = Object.fromEntries(data.pages.map((name) => [name, png]))
entries['README.txt'] = Buffer.from('Synthetic page-order fixture.')
const zip = zipSync(entries, { level: 6, mtime: new Date('2020-01-01T00:00:00Z') })
await write('local/本地作品/第1卷.cbz', zip)
for (const name of data.pages)
  await write('downloads/Source EN/星光日记/Group_Chapter 1/' + name, png)
await fs.writeFile(
  path.join(directory, 'fixture-manifest.json'),
  JSON.stringify(
    {
      syntheticOnly: true,
      inputFormatProof:
        'Source-derived protobuf messages with an explicitly opaque optional-field probe.',
      files
    },
    null,
    2
  ) + '\n'
)
console.log(JSON.stringify({ syntheticOnly: true, files: files.length }))
