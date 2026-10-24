import fs from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

export const directory = path.dirname(fileURLToPath(import.meta.url))
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const dependencies = [
  {
    name: 'protobufjs',
    version: '8.8.1',
    url: 'https://cdn.jsdelivr.net/npm/protobufjs@8.8.1/dist/protobuf.js',
    sha256: 'c12c396c0fe382441bed5fbef7fdc412b9cf0158f07d66a9c31a73e294e0439b'
  },
  {
    name: 'long',
    version: '5.3.2',
    url: 'https://cdn.jsdelivr.net/npm/long@5.3.2/umd/index.js',
    sha256: 'ea6da8d5fff04abc358b94488dbbb7eeb46e5027cc05303b1761cea94bef7821'
  }
]

// Only pinned public dependency bytes are evaluated; backup data is never evaluated.
export async function loadSchema() {
  const bundles = await Promise.all(
    dependencies.map(async (dependency) => {
      const response = await fetch(dependency.url, { signal: AbortSignal.timeout(25000) })
      if (!response.ok) throw new Error('Pinned proof dependency is unavailable.')
      const bytes = Buffer.from(await response.arrayBuffer())
      if (sha256(bytes) !== dependency.sha256)
        throw new Error('Proof dependency checksum mismatch.')
      const sandbox = {
        module: { exports: {} },
        exports: {},
        Buffer,
        Uint8Array,
        ArrayBuffer,
        DataView,
        TextEncoder,
        TextDecoder
      }
      vm.runInNewContext(bytes.toString('utf8'), sandbox, { timeout: 5000 })
      return { library: sandbox.module.exports, sandbox }
    })
  )
  const protobuf = bundles[0].library
  protobuf.util.Long = bundles[1].library
  protobuf.configure()
  const realmString = vm.runInNewContext('String', bundles[0].sandbox)
  const root = protobuf.parse(await fs.readFile(path.join(directory, 'backup.proto'), 'utf8')).root
  const type = root.lookupType('mihonproof.Backup')
  const decode = (input) => {
    let bytes = Buffer.from(input)
    if (bytes.length > 8 * 1024 * 1024) throw new Error('Proof input exceeds its fixture limit.')
    if (bytes[0] === 0x1f && bytes[1] === 0x8b)
      bytes = gunzipSync(bytes, { maxOutputLength: 8 * 1024 * 1024 })
    if (bytes.length === 0 || bytes[0] === 0x7b || bytes[0] === 0x5b)
      throw new Error('Unsupported backup input.')
    const message = type.decode(bytes)
    const result = type.toObject(message, {
      longs: realmString,
      bytes: realmString,
      defaults: true
    })
    if (!result.backupManga.length) throw new Error('Backup has no readable manga.')
    return structuredClone(result)
  }
  return { protobuf, root, type, decode }
}

export function categoryFor(backup, order) {
  const matches = backup.backupCategories.filter((category) => category.order === String(order))
  if (matches.length !== 1) throw new Error('Category order does not identify one category.')
  return matches[0]
}

export function mediaId(track) {
  const oldId = BigInt(track.mediaIdInt ?? 0)
  const newId = BigInt(track.mediaId ?? 0)
  if (oldId > 0n && newId > 0n && oldId !== newId) throw new Error('Tracking identities conflict.')
  const selected = oldId !== 0n ? oldId : newId
  if (selected <= 0n) throw new Error('Tracking identity is invalid.')
  return String(selected)
}

export function rating(tracker, value, family) {
  if (!['mihon-0.21.2', 'tachiyomi-0.15.3'].includes(family))
    throw new Error('Choose the source family.')
  if (!Number.isFinite(value)) throw new Error('Rating is not finite.')
  if (![1, 2, 3, 4, 5, 7, 10, 11, 12].includes(tracker))
    throw new Error('Tracker has no supported rating.')
  if (family === 'tachiyomi-0.15.3' && tracker >= 10)
    throw new Error('Tracker is outside this source family.')
  if (value === 0 || (tracker === 3 && family === 'mihon-0.21.2' && value === -1)) return null
  const factor =
    tracker === 2 || tracker === 11 ? 1 : tracker === 3 && family === 'mihon-0.21.2' ? 5 : 10
  const minimum =
    tracker === 3 && factor === 5 ? 2 : tracker === 7 && family === 'tachiyomi-0.15.3' ? 0.1 : 1
  const maximum = 100 / factor
  const scaled = value * factor
  if (value < minimum || value > maximum || Math.abs(scaled - Math.round(scaled)) > 0.0001)
    throw new Error('Rating is outside the stored scale.')
  const step = tracker === 7 || tracker === 2 || tracker === 11 ? 1 : tracker === 3 ? 5 : 10
  if (Math.round(scaled) % step !== 0) throw new Error('Rating does not use the stored increment.')
  return Math.round(scaled)
}

const stateTables = {
  1: { 1: 'active', 2: 'completed', 3: 'onHold', 4: 'unsupported', 6: 'planned', 7: 'active' },
  2: { 1: 'active', 2: 'completed', 3: 'onHold', 4: 'unsupported', 5: 'planned', 6: 'active' },
  3: { 1: 'active', 2: 'completed', 3: 'onHold', 4: 'unsupported', 5: 'planned' },
  4: { 1: 'active', 2: 'completed', 3: 'onHold', 4: 'unsupported', 5: 'planned', 6: 'active' },
  5: { 1: 'planned', 2: 'completed', 3: 'active', 4: 'onHold', 5: 'unsupported' },
  7: { 0: 'active', 1: 'planned', 2: 'completed', 3: 'unsupported', 4: 'onHold' },
  10: { 0: 'active', 1: 'completed', 2: 'onHold', 3: 'unsupported', 4: 'planned', 5: 'active' },
  11: {
    1: 'active',
    2: 'completed',
    3: 'onHold',
    4: 'unsupported',
    5: 'planned',
    6: 'active',
    7: 'unsupported'
  },
  12: { 1: 'active', 2: 'completed', 3: 'onHold', 4: 'unsupported', 5: 'planned' }
}
export function state(tracker, value) {
  return stateTables[tracker]?.[value] ?? 'unsupported'
}

export function position(chapter, pages, lastRead = '0') {
  const index = BigInt(chapter.lastPageRead)
  if (index < 0n || index > BigInt(Number.MAX_SAFE_INTEGER) || index >= BigInt(pages.length))
    throw new Error('Page index is outside this file.')
  if (index === 0n && BigInt(lastRead) <= 0n) return null
  return {
    type: 'page',
    page: { type: 'memberPath', path: pages[Number(index)] },
    point: { x: 0, y: 0 }
  }
}

// This probe only covers simple ASCII names. Production must reproduce the source comparator.
export function asciiNaturalPages(names) {
  if (names.some((name) => !/^[\x20-\x7e]+$/.test(name)))
    throw new Error('Outside the comparator probe.')
  const compare = (a, b) => {
    const aa = a.toLowerCase().match(/\d+|\D+/g)
    const bb = b.toLowerCase().match(/\d+|\D+/g)
    for (let index = 0; index < Math.min(aa.length, bb.length); index++) {
      const x = aa[index]
      const y = bb[index]
      if (x === y) continue
      if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
        const d = BigInt(x) - BigInt(y)
        if (d !== 0n) return d < 0n ? -1 : 1
        throw new Error('Ambiguous numeric tie in comparator probe.')
      }
      return x < y ? -1 : 1
    }
    return aa.length - bb.length
  }
  return [...names].sort(compare)
}

export function resolveRelative(root, relative) {
  if (path.isAbsolute(relative) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(relative))
    throw new Error('Source path is not relative.')
  const target = path.resolve(root, relative)
  const inside = path.relative(path.resolve(root), target)
  if (!inside || inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside))
    throw new Error('Source path escapes its selected root.')
  return target
}
