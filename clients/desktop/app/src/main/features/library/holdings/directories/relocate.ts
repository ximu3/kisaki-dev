import type { NativeFiles } from '#native'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseDirectoryRelocationInput,
  parseWorkRef,
  type HoldingsRelocationResult,
  type RelocatedPathTarget,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { and, eq } from 'drizzle-orm'
import { opendir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Storage } from '../../../../infrastructure/database'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../../infrastructure/files'
import { suffixBelow } from '../../../../infrastructure/files/registered-path'
import type { ChangeAdmission, UseTarget } from '../../change-admission'
import { commit, type CompleteWrite } from '../../transaction'
import { fileError } from '../errors'
import {
  applySubtitleMoves,
  prepareSubtitleMoves,
  type SubtitleMove,
} from '../files/anime/subtitles'
import { inspectTarget } from '../files/inspect'
import type { FileFacts } from '../files/record'
import { relocationStatus } from '../files/relocate'
import { moveFile } from '../files/write'
import { applyConfigMoves, prepareConfigMoves, type ConfigMove } from '../game/launch-configs/paths'
import type { launchConfigStorage } from '../game/launch-configs/storage'
import { existingPosition, expectPositions, type Position } from '../paths'
import type { holdingStorage } from '../storage'
import { directories } from './tables'

type FileMove = { id: string; from: string; to: string; facts: FileFacts }

interface RootMove {
  id: string
  from: string
  to: string
}

interface PreparedMove {
  root: RootMove
  baseline: readonly Position[]
  files: FileMove[]
  configs: ConfigMove[]
  subtitles: SubtitleMove[]
}

type PlanIssue = HoldingsRelocationResult['issues'][number]

type Applied = HoldingsRelocationResult['updated'][number]

export function relocationStorage(storage: Storage) {
  return {
    applyDirectoryMove: (work: WorkRef, plan: PreparedMove) =>
      commit(storage, (write) => {
        expectPositions(write.db, work, plan.baseline)
        const target = directories[work.type]
        if (plan.root.from !== plan.root.to) {
          const moved = write.db
            .update(target.table)
            .set({ path: plan.root.to, updatedAt: write.now })
            .where(
              and(
                eq(target.owner, work.id),
                eq(target.table.id, plan.root.id),
                eq(target.table.path, plan.root.from),
              ),
            )
            .run()
          if (!moved.changes) {
            throw new DesktopError(
              'Conflict',
              'The directory moved before the relocation was committed',
            )
          }
          write.changes.push({
            type: 'holdingsChanged',
            work,
            directoryIds: [plan.root.id],
          } as Extract<(typeof write.changes)[number], { type: 'holdingsChanged' }>)
        }
        if (work.type !== 'game') {
          for (const file of plan.files) {
            moveFile(write, { type: work.type, id: work.id }, file.id, file.to, file.facts)
          }
        }
        if (work.type === 'game') {
          applyConfigMoves(write, work.id, plan.configs)
        }
        if (work.type === 'anime') {
          applySubtitleMoves(write, work.id, plan.subtitles)
        }
      }),
  }
}

export function createDirectoryRelocation(
  call: DatabaseCall<
    ReturnType<typeof holdingStorage> &
      ReturnType<typeof launchConfigStorage> &
      ReturnType<typeof relocationStorage>
  >,
  complete: CompleteWrite,
  native: NativeFiles,
  resources: string,
  admit: ChangeAdmission,
  locations: () => void,
) {
  return async (
    raw: unknown,
    id: string,
    value: unknown,
    signal: AbortSignal,
  ): Promise<HoldingsRelocationResult> => {
    const work = parseWorkRef(raw),
      request = parseDirectoryRelocationInput(work.type, value)
    const baseline = await call('libraryPositions', work)
    const old = baseline.find((p) => p.kind === 'directory' && p.id === id)
    if (!old) {
      throw new DesktopError('NotFound', 'The registered directory does not exist')
    }
    if (request.expected && old.path !== request.expected.path) {
      throw new DesktopError('Conflict', 'The original directory path changed')
    }
    const path = normalizeAbsolutePath(request.path)
    const plan: PreparedMove = {
      root: { id, from: old.path, to: path },
      baseline,
      configs: [],
      subtitles: [],
      files: [],
    }
    const issues: PlanIssue[] = [],
      updated: Applied[] = []
    const report = () => ({ work, updated, issues }) as HoldingsRelocationResult
    const issue = (target: RelocatedPathTarget, at: string, cause: unknown) => {
      signal.throwIfAborted()
      issues.push({
        target,
        path: at,
        status: relocationStatus(cause),
        error: fileError(cause),
      } as PlanIssue)
    }
    try {
      const handle = await opendir(path)
      await handle.close()
      const existing = await existingPosition(
        baseline.filter((p) => p !== old),
        work,
        { path, kind: 'directory' },
        native,
        signal,
      )
      if (existing) {
        throw new DesktopError('PathConflict', 'The new root is already registered')
      }
    } catch (cause) {
      issue({ type: 'directory', id }, path, cause)
      return report()
    }

    async function mapped(original: string) {
      const suffix = await suffixBelow(old!.path, original, native)
      if (suffix === undefined) {
        throw new DesktopError('PathUnresolved', 'The old directory membership cannot be confirmed')
      }
      return suffix === null ? null : join(path, ...suffix)
    }
    async function verified(source: string, kind: 'directory' | 'file' | 'either') {
      const to = await mapped(source)
      if (!to || to === source) {
        return null
      }
      const data = await stat(to)
      if (
        (kind === 'file' && !data.isFile()) ||
        (kind === 'directory' && !data.isDirectory()) ||
        (!data.isFile() && !data.isDirectory())
      ) {
        throw new DesktopError('FileUnavailable', 'The mapped target has a different kind')
      }
      return to
    }

    if (work.type !== 'game') {
      for (const item of baseline) {
        if (item.kind === 'directory') {
          continue
        }
        signal.throwIfAborted()
        let destination = item.path
        try {
          const to = await mapped(item.path)
          if (!to || to === item.path) {
            continue
          }
          destination = to
          const facts = await inspectTarget(work.type, to, resources, signal)
          if ((item.kind === 'pages') !== (facts.kind === 'directory')) {
            throw new DesktopError('FileUnavailable', 'The mapped file has a different kind')
          }
          plan.files.push({ id: item.id, from: item.path, to, facts })
        } catch (cause) {
          issue({ type: 'file', id: item.id }, destination, cause)
        }
      }
      // A rejected mapping leaves its old position occupied. Recheck the remaining batch against that position.
      let rejected: boolean
      do {
        rejected = false
        const moves = new Map(plan.files.map((file) => [file.id, file.to]))
        const final = baseline.map((row) => ({ ...row, path: moves.get(row.id) ?? row.path }))
        const keep: FileMove[] = []
        for (const file of plan.files) {
          try {
            const kind = file.facts.kind === 'directory' ? 'pages' : 'file'
            if (
              await existingPosition(
                final.filter((row) => row.id !== file.id),
                work,
                { kind, path: file.to },
                native,
                signal,
              )
            ) {
              throw new DesktopError(
                'PathConflict',
                'The mapped file position is already registered',
              )
            }
            keep.push(file)
          } catch (cause) {
            issue({ type: 'file', id: file.id }, file.to, cause)
            rejected = true
          }
        }
        plan.files = keep
      } while (rejected)
    }
    if (work.type === 'game') {
      plan.configs = await prepareConfigMoves(
        call,
        work.id,
        request.gameConfigFields ?? [],
        verified,
        issue,
      )
    }
    if (work.type === 'anime') {
      plan.subtitles = await prepareSubtitleMoves(
        call,
        work.id,
        request.subtitlePaths ?? [],
        verified,
        issue,
      )
    }
    signal.throwIfAborted()
    const kind = work.type
    const uses: UseTarget[] =
      kind === 'game'
        ? plan.configs.map((config) => ({ type: 'configuration', kind: 'game', id: config.id }))
        : [
            ...plan.files.map<UseTarget>((file) => ({
              type: 'file',
              kind,
              id: file.id,
            })),
            ...plan.subtitles.map<UseTarget>((file) => ({
              type: 'file',
              kind: 'anime',
              id: file.id,
            })),
          ]
    complete(await admit(uses, () => call('applyDirectoryMove', work, plan)))
    if (path !== old.path) {
      updated.push({ target: { type: 'directory', id }, from: old.path, to: path })
    }
    for (const file of plan.files) {
      updated.push({ target: { type: 'file', id: file.id }, from: file.from, to: file.to })
    }
    for (const c of plan.configs) {
      updated.push({
        target: { type: 'launchConfig', id: c.id, field: c.field },
        from: c.from,
        to: c.to,
      })
    }
    for (const s of plan.subtitles) {
      updated.push({
        target: { type: 'subtitle', fileId: s.id, path: s.from },
        from: s.from,
        to: s.to,
      })
    }
    if (updated.length) {
      locations()
    }
    return report()
  }
}
