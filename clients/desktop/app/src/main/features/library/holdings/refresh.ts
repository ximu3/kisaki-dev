import { open, opendir, stat } from 'node:fs/promises'
import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import type { HoldingsRefreshResult, FileAvailability } from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import { registeredRelation as comparePaths } from '../../../infrastructure/files/registered-path'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { CompleteWrite } from '../transaction'
import type { FileWork, FileFacts } from './files/storage'
import { discover, fileError } from './discover'
import { inspectTarget, type registration } from './registration'
import type { holdingStorage } from './storage'
import type { createRecognition } from './recognition'

export function createRefresh(
  call: DatabaseCall<ReturnType<typeof holdingStorage>>,
  complete: CompleteWrite,
  native: NativeFiles,
  resources: string,
  register: ReturnType<typeof registration>,
  recognition: ReturnType<typeof createRecognition>,
) {
  const queue = new Map<string, Promise<void>>()
  async function run(
    work: FileWork,
    signal: AbortSignal,
    affected: readonly string[] | null,
    maintenance: readonly string[] | null,
  ): Promise<HoldingsRefreshResult> {
    const files: HoldingsRefreshResult['files'][number][] = [],
      issues: { path: string; error: ErrorSummary }[] = [],
      registeredFileIds: string[] = []
    let finished = false
    const report = () =>
      ({ work, files, discovery: { finished, registeredFileIds, issues } }) as HoldingsRefreshResult
    async function needs(path: string, root: boolean) {
      const changes = root ? affected : maintenance
      if (!changes) {
        return true
      }
      for (const change of changes) {
        if (change === path) {
          return true
        }
        const relation = await comparePaths(path, change, native)
        if (
          relation === 'same' ||
          relation === 'within' ||
          relation === 'unknown' ||
          (root && relation === 'contains')
        ) {
          return true
        }
      }
      return false
    }
    try {
      const roots = await call('listWorkDirectories', work, true)
      const protectedPaths = await call('recoveryPaths')
      for (const dir of roots) {
        signal.throwIfAborted()
        if (!('definition' in dir) || !(await needs(dir.path, true))) {
          continue
        }
        if (dir.definition.status === 'invalid') {
          issues.push({ path: dir.path, error: dir.definition.error })
          continue
        }
        const positions = await call('libraryPositions', work)
        const found = await discover(
          work.type,
          dir.path,
          dir.definition.value,
          positions,
          protectedPaths,
          native,
          signal,
          affected,
        )
        issues.push(...found.issues)
        const known = new Set(positions.filter((p) => p.kind !== 'directory').map((p) => p.path))
        for (const path of found.paths) {
          if (known.has(path)) {
            continue
          }
          signal.throwIfAborted()
          try {
            const added = await register.file(work, { path }, signal, undefined, {
              id: dir.id,
              path: dir.path,
              definition: dir.definition.value,
            })
            if (added.created) {
              registeredFileIds.push(added.id)
            }
          } catch (cause) {
            signal.throwIfAborted()
            issues.push({ path, error: fileError(cause) })
          }
        }
      }
      finished = issues.length === 0
      const registered = new Set(registeredFileIds)
      await recognition.withAutomatic(work, signal, async (one) => {
        for (const item of await call('libraryPositions', work)) {
          if (
            item.kind === 'directory' ||
            (!registered.has(item.id) && !(await needs(item.path, false)))
          ) {
            continue
          }
          signal.throwIfAborted()
          let availability: FileAvailability,
            facts: FileFacts | null = null
          try {
            const current = await stat(item.path)
            const pages = item.kind === 'pages'
            if (pages ? !current.isDirectory() : !current.isFile()) {
              throw new DesktopError('FileUnavailable', 'The registered content kind has changed')
            }
            const input = pages ? await opendir(item.path) : await open(item.path, 'r')
            await input.close()
            availability = { status: 'accessible', checkedAt: Date.now() }
            try {
              facts = await inspectTarget(work.type, item.path, resources, signal)
            } catch (cause) {
              signal.throwIfAborted()
              issues.push({ path: item.path, error: fileError(cause) })
            }
          } catch (cause) {
            signal.throwIfAborted()
            availability = {
              status: 'unavailable',
              checkedAt: Date.now(),
              reason:
                cause instanceof Error &&
                'code' in cause &&
                (cause.code === 'ENOENT' || cause.code === 'ENOTDIR')
                  ? 'missing'
                  : 'unreadable',
              error: fileError(cause),
            }
          }
          signal.throwIfAborted()
          try {
            complete(await call('checkWorkFile', work, item.id, item.path, availability, facts))
            const result =
              availability.status === 'accessible'
                ? await one(item.id)
                : { recognition: null, associationOutcome: 'notAttempted' as const }
            files.push({
              fileId: item.id,
              availability,
              ...result,
            } as HoldingsRefreshResult['files'][number])
          } catch (cause) {
            signal.throwIfAborted()
            issues.push({ path: item.path, error: fileError(cause) })
          }
        }
      })
      return report()
    } catch (cause) {
      throw new DesktopError(
        signal.aborted ? 'Cancelled' : fileError(cause).code,
        'Local content refresh interrupted',
        { cause, partialResult: report() },
      )
    }
  }
  return async function refresh(
    work: FileWork,
    signal: AbortSignal,
    affected: readonly string[] | null = null,
    maintenance: readonly string[] | null = affected,
  ) {
    const previous = queue.get(work.id) ?? Promise.resolve()
    const result = previous.then(() => {
      signal.throwIfAborted()
      return run(work, signal, affected, maintenance)
    })
    const done = result.then(
      () => {},
      () => {},
    )
    queue.set(work.id, done)
    try {
      return await result
    } finally {
      if (queue.get(work.id) === done) {
        queue.delete(work.id)
      }
    }
  }
}
