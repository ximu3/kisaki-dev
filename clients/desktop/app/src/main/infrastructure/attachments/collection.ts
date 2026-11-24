import { readdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import type { AttachmentCleanupResult } from '@kisaki3/desktop-contracts/attachments'
import type { DatabaseCall } from '../database/executor'
import { storedFilePath } from '../files'
import { checkDirectory, entryInfo } from './paths'
import type { attachmentStorage } from './storage'

async function removeFile(root: string, path: string) {
  await checkDirectory(root)
  await checkDirectory(dirname(path))
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

  function reportIssues(result: AttachmentCleanupResult) {
    for (const issue of result.issues) {
      report(new DesktopError(issue.error.code, issue.error.message))
    }
  }

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
    async drain(this: void) {
      await Promise.all(retirements)
    },
    released(id: string) {
      if (deferred.delete(id)) {
        retire([id])
      }
    },
    async cleanup(this: void, signal?: AbortSignal): Promise<AttachmentCleanupResult> {
      const files = new Set<string>()
      const issues: { attachmentId: string; error: ErrorSummary }[] = []
      let removedCount = 0
      let reclaimedBytes = 0

      try {
        const shards = (await checkDirectory(root))
          ? await readdir(root, { withFileTypes: true })
          : []
        for (const shard of shards) {
          signal?.throwIfAborted()
          if (!shard.isDirectory() || !/^[0-9a-f]{2}$/.test(shard.name)) {
            continue
          }
          const folder = join(root, shard.name)
          await checkDirectory(folder)
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
