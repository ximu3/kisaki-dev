import { randomUUID } from 'node:crypto'
import { releaseAll, rethrowAfterRelease } from './release'
import { open, type FileHandle } from 'node:fs/promises'
import { Readable } from 'node:stream'
import type { Session } from 'electron'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  ReadResourceRef,
  ReadResource,
  ViewResourceBinding,
} from '@kisaki3/desktop-contracts/resources'

/** File metadata fixed for the entire lifetime of an acquired resource. */
export interface ResourceFile {
  readonly sha256: string
  readonly path: string
  readonly size: number
  readonly mediaType: string
}

/** Reference counts represent actual held content, including in-flight protocol response streams. */
export function createResources() {
  const readers = new Map<
    string,
    { file: ResourceFile; count: number; release: () => Promise<void> }
  >()

  function retain(content: {
    file: ResourceFile
    count: number
    release: () => Promise<void>
  }): ReadResource {
    const ref = Object.freeze({ id: randomUUID() })
    readers.set(ref.id, content)
    content.count++
    return {
      resource: ref,
      /** Withdraws this capability and releases the backing content after its last hold. */
      async dispose() {
        if (readers.delete(ref.id) && --content.count === 0) {
          await content.release()
        }
      },
    }
  }

  /** Resolves a host-issued capability or rejects a revoked read. */
  function resolve(ref: ReadResourceRef) {
    const content = readers.get(ref.id)
    if (!content) {
      throw new DesktopError('InvalidReference', 'The resource is no longer available')
    }
    return content
  }
  const sessions = new Map<Session, Map<string, Map<string, ReadResource>>>()

  /** Resolves an address only in the session and document scope holding its content. */
  async function respond(scopes: Map<string, Map<string, ReadResource>>, request: Request) {
    const url = new URL(request.url)
    const read = scopes.get(url.hostname)?.get(url.pathname.slice(1))
    if (!read) {
      return new Response(null, { status: 404 })
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response(null, { status: 405 })
    }
    const content = resolve(read.resource)
    const { file } = content
    const headers = new Headers({
      'Content-Type': file.mediaType,
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    })
    const range = request.headers.get('range')
    let start = 0
    let end = file.size - 1
    if (range) {
      const parts = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!parts || (!parts[1] && !parts[2])) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': 'bytes */' + file.size },
        })
      }
      start = parts[1] ? Number(parts[1]) : Math.max(0, file.size - Number(parts[2]))
      if (parts[1] && parts[2]) {
        end = Math.min(end, Number(parts[2]))
      }
      if (start > end || !Number.isSafeInteger(start)) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': 'bytes */' + file.size },
        })
      }
      headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + file.size)
    }
    headers.set('Content-Length', String(end - start + 1))
    const init = { headers, status: range ? 206 : 200 }
    if (request.method === 'HEAD' || file.size === 0) {
      return new Response(null, init)
    }
    const hold = retain(content)
    let handle: FileHandle | undefined
    try {
      handle = await open(file.path, 'r')
      const stream = handle.createReadStream({ start, end, signal: request.signal })
      stream.once('close', () => {
        void hold.dispose().catch(console.error)
      })
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array<ArrayBuffer>>, init)
    } catch (error) {
      return rethrowAfterRelease(error, () =>
        releaseAll([() => handle?.close(), () => hold.dispose()]),
      )
    }
  }

  return {
    /** Acquires a new held immutable file with its owner's final release callback. */
    acquire(file: ResourceFile, release: () => Promise<void>) {
      return retain({ file, release, count: 0 })
    },
    /** Acquires an independent capability for already-held bytes. */
    hold(ref: ReadResourceRef) {
      return retain(resolve(ref))
    },
    file(ref: ReadResourceRef) {
      return resolve(ref).file
    },
    /** Installs a distinct resource origin for each document in its actual Electron session. */
    view(session: Session) {
      const scope = randomUUID()
      const bound = new Map<string, ReadResource>()
      let disposed = false
      let scopes = sessions.get(session)
      if (!scopes) {
        const registered = new Map<string, Map<string, ReadResource>>()
        session.protocol.handle('kisaki-resource', (request) => respond(registered, request))
        sessions.set(session, registered)
        scopes = registered
      }
      scopes.set(scope, bound)
      return {
        origin: 'kisaki-resource://' + scope,
        /** Retains each input in this document's own scope; revocation of the source leaves these URLs usable. */
        async bind<K extends string>(
          inputs: Readonly<Record<K, ReadResourceRef>>,
        ): Promise<ViewResourceBinding<K>> {
          if (disposed) {
            throw new DesktopError('InvalidReference', 'The document has closed')
          }
          const entries = Object.entries<ReadResourceRef>(inputs).map(
            ([key, ref]) => [key, resolve(ref)] as const,
          )
          const holds = entries.map(([key, content]) => {
            const read = retain(content)
            bound.set(read.resource.id, read)
            return [key, read] as const
          })
          return {
            urls: Object.fromEntries(
              holds.map(([key, read]) => [
                key,
                'kisaki-resource://' + scope + '/' + read.resource.id,
              ]),
            ) as Record<K, string>,
            /** Revokes this binding's URLs and returns its independent holds. */
            async dispose() {
              for (const [, read] of holds) {
                bound.delete(read.resource.id)
              }
              await releaseAll(
                holds.map(
                  ([, read]) =>
                    () =>
                      read.dispose(),
                ),
              )
            },
          }
        },
        /** Revokes the document's remaining bindings while in-flight streams retain their own holds. */
        async dispose() {
          if (disposed) {
            return
          }
          disposed = true
          scopes.delete(scope)
          const held = [...bound.values()]
          bound.clear()
          await releaseAll([
            () => {
              if (!scopes.size) {
                sessions.delete(session)
                session.protocol.unhandle('kisaki-resource')
              }
            },
            ...held.map((read) => () => read.dispose()),
          ])
        },
      }
    },
  }
}
