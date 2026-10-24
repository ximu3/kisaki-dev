// Each worker owns one source and a small fixture-only cache of validated regular payloads.
import factory from '/build/unrar.mjs'
import { openArchive } from './archive.mjs'
import { createMemberIndex, MemberFailure } from './members.mjs'
import { runPolicyCases } from './policy-cases.mjs'
onmessage = async ({ data }) => {
  let archive
  try {
    const policyCases = runPolicyCases()
    let readCalls = 0,
      readBytes = 0,
      maxRead = 0
    const source = {
      size: data.size,
      read: async (offset, length) => {
        if (!length) return new Uint8Array()
        const response = await fetch('/fixture/' + encodeURIComponent(data.name), {
          headers: { Range: `bytes=${offset}-${offset + length - 1}` }
        })
        if (
          response.status !== 206 ||
          response.headers.get('Content-Range') !==
            `bytes ${offset}-${offset + length - 1}/${data.size}`
        )
          throw new Error('Invalid source range')
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (bytes.length !== length || length > 65536) throw new Error('Invalid source response')
        readCalls++
        readBytes += length
        maxRead = Math.max(maxRead, length)
        return bytes
      }
    }
    archive = await openArchive(factory, source)
    const entries = await archive.list()
    const index = createMemberIndex(entries)
    const cache = new Map()
    let cachedBytes = 0,
      decodedTargets = 0
    const requests = []
    for (const request of data.requests) {
      try {
        const resolved = index.resolve(request.path)
        if (request.error) throw new Error('Unsafe reference was accepted')
        if (request.target && resolved.target.name !== request.target)
          throw new Error('Reference target differs')
        if (resolved.target.directory) {
          if (!request.directory) throw new Error('File request resolved to a directory')
          requests.push({
            path: resolved.memberPath,
            target: resolved.target.name,
            directory: true
          })
          continue
        }
        let bytes = cache.get(resolved.target.index)
        if (!bytes) {
          const chunks = []
          let length = 0
          await archive.read(resolved.target, async (chunk) => {
            length += chunk.length
            if (cachedBytes + length > 65536)
              throw new Error('Fixture cache exceeded its explicit budget')
            chunks.push(chunk)
          })
          bytes = new Uint8Array(length)
          let offset = 0
          for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.length
          }
          cache.set(resolved.target.index, bytes)
          cachedBytes += length
          decodedTargets++
        }
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        const sha256 = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('')
        if (request.text !== undefined && new TextDecoder().decode(bytes) !== request.text)
          throw new Error('Known member content differs')
        requests.push({
          path: resolved.memberPath,
          target: resolved.target.name,
          bytes: bytes.length,
          sha256
        })
      } catch (error) {
        if (!(error instanceof MemberFailure) || error.reason !== request.error) throw error
        requests.push({ path: request.path, rejected: error.reason })
      }
    }
    const disposed = await archive.dispose()
    archive = null
    const beforeClear = cache.size
    cache.clear()
    postMessage({
      ok: true,
      name: data.name,
      entries,
      requests,
      decodedTargets,
      cachedBytes,
      cachedMembers: beforeClear,
      cacheAfterDispose: cache.size,
      readCalls,
      readBytes,
      maxRead,
      disposed,
      policyCases
    })
  } catch (error) {
    if (archive) await archive.dispose()
    postMessage({
      ok: false,
      reason: error instanceof MemberFailure ? error.reason : 'Probe failed',
      detail: error.message
    })
  }
}
