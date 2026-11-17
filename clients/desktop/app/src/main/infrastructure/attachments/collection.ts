/** @fileoverview Reclaims detached attachments and reconciles interrupted publication in bounded database batches. */

import { lstat, readdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import type { AttachmentCleanupResult } from '@kisaki3/desktop-contracts/attachments'
import type { DatabaseCall } from '../database/executor'
import { storedFilePath } from '../files'
import type { attachmentStorage } from './storage'

/** Checks the actual directory entry without following a replaced shard or file. */
export async function entryInfo(path: string) {
  return lstat(path).catch((cause: NodeJS.ErrnoException) => {
    if (cause.code === 'ENOENT') {
      return null
    }
    throw cause
  })
}

/** Verifies an existing private directory before traversing it. */
export async function directory(path: string) {
  const info = await entryInfo(path)
  if (info && !info.isDirectory()) {
    throw new DesktopError('PathConflict', 'An attachment directory has been replaced')
  }
  return info !== null
}

/** Removes one proven regular file, reporting only bytes actually unlinked. */
async function removeFile(root: string, path: string) {
  await directory(root)
  await directory(dirname(path))
  const info = await entryInfo(path)
  if (!info) {
    return null
  }
  if (!info.isFile()) {
    throw new DesktopError('PathConflict', 'The attachment path is not a managed file')
  }
  try {
    await unlink(path)
    return info.size
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw cause
  }
}

/** Collects unreferenced rows using the same serialized acquisition boundary as preparation and reading. */
export function createCollection(
  root: string,
  held: ReadonlyMap<string, number>,
  owned: <T>(work: () => Promise<T>) => Promise<T>,
  call: DatabaseCall<ReturnType<typeof attachmentStorage>>,
  report: (cause: unknown) => void,
) {
  const deferred = new Set<string>()
  const batchSize = 128
  const retirements = new Set<Promise<void>>()

  /** Rechecks references under the write transaction and finishes physical removals outside SQLite. */
  async function reclaim(ids: readonly string[]) {
    const removed = await owned(async () => {
      const eligible = ids.filter((id) => {
        if (!held.has(id)) {
          return true
        }
        deferred.add(id)
        return false
      })
      return eligible.length ? call('reclaimAttachments', eligible) : []
    })

    let removedCount = 0
    let reclaimedBytes = 0
    const issues: { attachmentId: string; error: ErrorSummary }[] = []
    // A committed removal closes admission for the immutable identity. Filesystem I/O can yield to readers.
    for (const { id } of removed) {
      try {
        const size = await removeFile(root, storedFilePath(root, id))
        if (size !== null) {
          removedCount++
          reclaimedBytes += size
        }
      } catch (cause) {
        issues.push({
          attachmentId: id,
          error: {
            code: cause instanceof DesktopError ? cause.code : 'WriteFailed',
            message: 'The attachment file could not be removed',
          },
        })
      }
    }
    return { removedCount, reclaimedBytes, issues }
  }

  /** Reports deferred maintenance failures independently of the completed business transaction. */
  function reportIssues(result: AttachmentCleanupResult) {
    for (const issue of result.issues) {
      report(new DesktopError(issue.error.code, issue.error.message))
    }
  }

  /** Schedules only the identities detached by a committed edit. */
  function retire(ids: readonly string[]) {
    if (!ids.length) {
      return
    }
    const work = (async () => {
      for (let at = 0; at < ids.length; at += batchSize) {
        const batch = ids.slice(at, at + batchSize)
        reportIssues(await reclaim(batch))
      }
    })().catch(report)
    retirements.add(work)
    void work.then(() => retirements.delete(work))
  }

  return {
    retire,
    /** Waits for all business-triggered batches accepted before database shutdown. */
    async drain(this: void) {
      await Promise.all(retirements)
    },
    /** Retries held candidates when their last reader releases them inside the ownership boundary. */
    released(id: string) {
      if (deferred.delete(id)) {
        retire([id])
      }
    },
    /** Reconciles registered rows and orphan files while yielding the ownership queue between batches. */
    async cleanup(this: void, signal?: AbortSignal): Promise<AttachmentCleanupResult> {
      const files = new Set<string>()
      const issues: { attachmentId: string; error: ErrorSummary }[] = []
      let removedCount = 0
      let reclaimedBytes = 0

      try {
        const shards = (await directory(root)) ? await readdir(root, { withFileTypes: true }) : []
        for (const shard of shards) {
          signal?.throwIfAborted()
          if (!shard.isDirectory() || !/^[0-9a-f]{2}$/.test(shard.name)) {
            continue
          }
          const folder = join(root, shard.name)
          await directory(folder)
          for (const file of await readdir(folder, { withFileTypes: true })) {
            if (file.isFile() && /^[0-9a-f]{62}$/.test(file.name)) {
              files.add(join(folder, file.name))
            }
          }
        }

        // Observe holds after enumerating disk. Every captured file still eligible for first
        // adoption has a preparation at this point. Later publications receive fresh identities.
        await owned(async () => {
          for (const id of held.keys()) {
            files.delete(storedFilePath(root, id))
          }
        })
        let after: string | null = null
        for (;;) {
          signal?.throwIfAborted()
          const page: { id: string; unused: boolean }[] = await call(
            'attachmentCandidates',
            after,
            batchSize,
          )
          if (!page.length) {
            break
          }
          for (const row of page) {
            files.delete(storedFilePath(root, row.id))
          }
          const candidates = page.filter((row) => row.unused).map((row) => row.id)
          if (candidates.length) {
            const result = await reclaim(candidates)
            removedCount += result.removedCount
            reclaimedBytes += result.reclaimedBytes
            issues.push(...result.issues)
          }
          after = page.at(-1)!.id
        }

        for (const path of files) {
          signal?.throwIfAborted()
          const size = await removeFile(root, path)
          if (size !== null) {
            removedCount++
            reclaimedBytes += size
          }
        }
      } catch (cause) {
        const cancelled = signal?.aborted && cause === signal.reason
        const code = cause instanceof DesktopError ? cause.code : 'OperationFailed'
        throw new DesktopError(
          cancelled ? 'Cancelled' : code,
          'Attachment cleanup did not finish',
          {
            cause,
            partialResult: { removedCount, reclaimedBytes, issues },
          },
        )
      }
      return { removedCount, reclaimedBytes, issues }
    },
  }
}
