import { releaseAll, rethrowAfterRelease } from '../release'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, rename, rmdir, open } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseFileInput,
  type FileInput,
  type ReadResourceRef,
  type ReadResource,
} from '@kisaki3/desktop-contracts/resources'
import {
  parseListOptions,
  type ListOptions,
  type CallOptions,
} from '@kisaki3/desktop-contracts/operations'
import type { NativeFiles } from '#native'
import {
  normalizeAbsolutePath,
  stageFile,
  storedFilePath,
  publishStoredFile,
  syncDirectory,
  type StagedFile,
} from '../files'
import type { DatabaseCall } from '../database/executor'
import { createCollection } from './collection'
import { checkDirectory, entryInfo } from './paths'
import type { attachmentStorage } from './storage'
import type { createResources } from '../resources'
import type { createNetwork } from '../network'

/** Immutable managed bytes plus the facts a business transaction may adopt. */
export interface PreparedContent {
  readonly metadata: Attachment
  readonly resource: ReadResourceRef
  /** Ends this acquisition after validation or ownership transfer. */
  dispose(): Promise<void>
}

/** Creates the attachment store for one locked data root. */
export function createAttachments(
  dataRoot: string,
  native: NativeFiles,
  resources: ReturnType<typeof createResources>,
  network: Pick<ReturnType<typeof createNetwork>, 'fetch'>,
  call: DatabaseCall<ReturnType<typeof attachmentStorage>>,
  report: (cause: unknown) => void = console.error,
) {
  const root = join(dataRoot, 'attachments')
  const temporary = join(dataRoot, 'staging')
  const held = new Map<string, number>()
  const preparations = new Map<string, Attachment>()
  let queue = Promise.resolve()

  /** Resolves the private layout without following an externally replaced shard or file link. */
  async function managedPath(id: string) {
    const path = storedFilePath(root, id)
    await checkDirectory(root)
    await checkDirectory(dirname(path))
    const info = await entryInfo(path)
    if (info && !info.isFile()) {
      throw new DesktopError('PathConflict', 'The attachment path is not a managed file')
    }
    return path
  }

  /** Opens a local input or registered file with a stable public availability error. */
  async function openFile(path: string) {
    try {
      return await open(path, 'r')
    } catch (cause) {
      throw new DesktopError('FileUnavailable', 'The file could not be opened for reading', {
        cause,
      })
    }
  }

  /** Checks actual readability and size without relinquishing the saved identity. */
  async function checkBytes(metadata: Attachment) {
    const handle = await openFile(await managedPath(metadata.id))
    try {
      const info = await handle.stat()
      if (!info.isFile() || info.size !== metadata.sizeBytes) {
        throw new DesktopError('FileUnavailable', 'The attachment bytes are unavailable')
      }
    } finally {
      await handle.close()
    }
  }

  /** Serializes acquisition/publication with physical reclamation, never blocking unrelated byte reads. */
  function owned<T>(action: () => Promise<T>) {
    const result = queue.then(action)
    queue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  const collection = createCollection(root, held, owned, call, report)

  /** Retains one attachment until all resources derived from this acquisition end. */
  function hold(metadata: Attachment, prepared: boolean) {
    held.set(metadata.id, (held.get(metadata.id) ?? 0) + 1)
    const path = storedFilePath(root, metadata.id)
    return resources.acquire(
      { path, size: metadata.sizeBytes, mediaType: metadata.mediaType, sha256: metadata.sha256 },
      () =>
        owned(async () => {
          const remaining = held.get(metadata.id)! - 1
          if (remaining) {
            held.set(metadata.id, remaining)
          } else {
            held.delete(metadata.id)
            const wasPrepared = preparations.delete(metadata.id)
            if ((prepared || wasPrepared) && !(await call('getAttachment', metadata.id))) {
              await rm(await managedPath(metadata.id), { force: true })
            }
            collection.released(metadata.id)
          }
        }),
    )
  }

  async function stage(input: FileInput | Readable, limit: number, signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (input instanceof Readable) {
      return stageFile(temporary, input, native, limit, signal)
    }
    const value = parseFileInput(input)
    if (value.type === 'bytes') {
      return stageFile(temporary, Readable.from([value.bytes]), native, limit, signal)
    }
    if (value.type === 'path') {
      return stageFile(
        temporary,
        (await openFile(normalizeAbsolutePath(value.path))).createReadStream(),
        native,
        limit,
        signal,
      )
    }
    if (value.type === 'resource') {
      const lease = resources.hold(value.resource)
      try {
        return await stageFile(
          temporary,
          (await openFile(resources.file(lease.resource).path)).createReadStream(),
          native,
          limit,
          signal,
        )
      } finally {
        await lease.dispose()
      }
    }
    const response = await network.fetch(value.url, { ...value, ...(signal && { signal }) })
    if (!response.ok || !response.body) {
      await response.body?.cancel()
      throw new DesktopError('ReadFailed', 'The file download did not succeed')
    }
    return stageFile(
      temporary,
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      native,
      limit,
      signal,
    )
  }

  return {
    stage,
    /** Snapshots former staging directories before this process starts accepting file inputs. */
    async interruptedStages() {
      if (!(await checkDirectory(temporary))) {
        return []
      }
      return (await readdir(temporary, { withFileTypes: true }))
        .filter((dir) => dir.isDirectory() && /^file-[a-zA-Z0-9]{6}$/.test(dir.name))
        .map((dir) => dir.name)
    },
    /** Completes cleanup of the captured stages independently of this process's live preparations. */
    async cleanInterruptedStages(stages: readonly string[], signal: AbortSignal) {
      for (const name of stages) {
        signal.throwIfAborted()
        const path = join(temporary, name)
        try {
          await checkDirectory(temporary)
          await checkDirectory(path)
          const members = await readdir(path, { withFileTypes: true })
          if (members.some((file) => file.name !== 'content' || !file.isFile())) {
            continue
          }
          await rm(join(path, 'content'), { force: true })
          await rmdir(path)
        } catch (cause) {
          report(cause)
        }
      }
    },
    /** Pins only the final referenced IDs until the owner's transaction adopts their metadata and references. */
    async forSave(ids: readonly string[], authorized: ReadonlyMap<string, ReadResourceRef>) {
      const reads: ReadResource[] = []
      const records: Attachment[] = []
      const existing: string[] = []
      const dispose = async () => {
        await releaseAll(reads.map((read) => () => read.dispose()))
      }
      try {
        for (const id of new Set(ids)) {
          const ref = authorized.get(id)
          if (!ref) {
            existing.push(id)
            continue
          }
          const prepared = preparations.get(id)
          if (!prepared || resources.file(ref).path !== storedFilePath(root, id)) {
            throw new DesktopError('InvalidReference', 'This preparation cannot be adopted')
          }
          reads.push(resources.hold(ref))
          records.push(prepared)
        }
        await owned(async () => {
          for (const id of existing) {
            const saved = await call('getAttachment', id)
            if (!saved) {
              throw new DesktopError('InvalidReference', 'The referenced attachment does not exist')
            }
            reads.push(hold(saved, false))
          }
        })
        return { records, dispose }
      } catch (error) {
        return rethrowAfterRelease(error, dispose)
      }
    },
    /** Publishes verified bytes under a fresh identity but creates no formal attachment row. */
    async prepare(
      file: StagedFile,
      mediaType: string,
      width: number | null = null,
      height: number | null = null,
    ): Promise<PreparedContent> {
      const metadata: Attachment = {
        id: randomUUID(),
        mediaType,
        sizeBytes: file.byteSize,
        sha256: file.sha256,
        width,
        height,
        createdAt: Date.now(),
      }
      return owned(async () => {
        await managedPath(metadata.id)
        await publishStoredFile(root, metadata.id, file, native)
        preparations.set(metadata.id, metadata)
        return { metadata, ...hold(metadata, true) }
      })
    },
    /** Reads metadata without claiming that the underlying file is available. */
    async get(id: string, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return call('getAttachment', id)
    },
    /** Acquires only registered content and retains its identity if the file is missing. */
    read(id: string, options?: CallOptions) {
      return owned(async () => {
        options?.signal?.throwIfAborted()
        const metadata = await call('getAttachment', id)
        if (!metadata) {
          throw new DesktopError('NotFound', 'The attachment does not exist')
        }
        await checkBytes(metadata)
        options?.signal?.throwIfAborted()
        return hold(metadata, false)
      })
    },
    async inspect(options: ListOptions, context?: CallOptions) {
      context?.signal?.throwIfAborted()
      const { items, total } = await call('listAttachments', parseListOptions(options))
      return {
        total,
        items: await Promise.all(
          items.map(async (attachment) => ({
            attachment,
            available: await checkBytes(attachment).then(
              () => true,
              () => false,
            ),
          })),
        ),
      }
    },
    /** Replaces unavailable bytes only after checking the digest against the registered identity. */
    async repair(id: string, input: FileInput, options?: CallOptions) {
      const signal = options?.signal
      signal?.throwIfAborted()
      const metadata = await call('getAttachment', id)
      if (!metadata) {
        throw new DesktopError('NotFound', 'The attachment does not exist')
      }
      const file = await stage(input, metadata.sizeBytes, signal)
      try {
        if (file.sha256 !== metadata.sha256) {
          throw new DesktopError('InvalidInput', 'These bytes do not match the saved attachment')
        }
        await owned(async () => {
          if (!(await call('getAttachment', id))) {
            throw new DesktopError('NotFound', 'The attachment was removed')
          }
          const path = await managedPath(id)
          await mkdir(dirname(path), { recursive: true })
          signal?.throwIfAborted()
          await rename(file.path, path)
          await syncDirectory(dirname(path))
          if (process.platform === 'darwin') {
            await native.syncFile(path)
          }
        })
      } finally {
        await file.dispose()
      }
    },
    retire: collection.retire,
    cleanup: (options?: CallOptions) => collection.cleanup(options?.signal),
    /** Waits for admitted reclamation and acquisitions before closing the database. */
    async drain() {
      await queue
      await collection.drain()
    },
  }
}
