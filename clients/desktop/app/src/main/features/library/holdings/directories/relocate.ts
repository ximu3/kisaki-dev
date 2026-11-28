import { opendir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseDirectoryRelocationInput,
  parseWorkRef,
  type WorkRef,
  type GameLaunchDefinition,
  type FilePlaybackChoices,
  type HoldingsRelocationResult,
  type RelocatedPathTarget,
} from '@kisaki3/desktop-contracts/library'
import { gameLaunchConfigs, animeFiles } from '../../../../infrastructure/database/schema'
import { ready } from '../../../../infrastructure/database/codecs/json'
import type { Storage } from '../../../../infrastructure/database'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../../infrastructure/files'
import { suffixBelow } from '../../../../infrastructure/files/registered-path'
import type { NativeFiles } from '#native'
import type { ChangeAdmission, UseTarget } from '../../../../infrastructure/use-targets'
import { commit, type CompleteWrite } from '../../transaction'
import { directories } from '../tables'
import { expectPositions, existingPosition, type Position } from '../positions'
import { moveFile, type holdingStorage } from '../storage'
import { fileChange, type FileFacts } from '../files/storage'
import { inspectTarget } from '../registration'
import { fileError } from '../discover'
import { relocationStatus } from '../files/relocate'
import type { configStorage } from '../game/configurations'

type ConfigField = Extract<RelocatedPathTarget, { type: 'launchConfig' }>['field']
type FileMove = { id: string; from: string; to: string; facts: FileFacts }
interface ConfigMove {
  id: string
  field: ConfigField
  from: string
  to: string
}
interface SubtitleMove {
  id: string
  from: string
  to: string
}
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
function configPath(def: GameLaunchDefinition, key: ConfigField) {
  switch (key) {
    case 'launchPath':
      return def.launch.type === 'file' ? { path: def.launch.path, kind: 'file' as const } : null
    case 'workingDirectory':
      return def.launch.type === 'command'
        ? { path: def.launch.workingDirectory, kind: 'directory' as const }
        : null
    case 'monitorPath':
      return def.monitor.type !== 'process'
        ? { path: def.monitor.path, kind: def.monitor.type }
        : null
    case 'savePath':
      return { path: def.savePath, kind: 'either' as const }
  }
}
function setConfigPath(def: GameLaunchDefinition, change: ConfigMove): GameLaunchDefinition {
  const previous = configPath(def, change.field)
  if (previous?.path !== change.from) {
    throw new DesktopError('Conflict', 'A selected configuration path changed')
  }
  switch (change.field) {
    case 'launchPath':
      return { ...def, launch: { type: 'file', path: change.to } }
    case 'workingDirectory': {
      if (def.launch.type !== 'command') {
        throw new DesktopError('Conflict', 'The launch method changed')
      }
      return { ...def, launch: { ...def.launch, workingDirectory: change.to } }
    }
    case 'monitorPath': {
      if (def.monitor.type === 'process') {
        throw new DesktopError('Conflict', 'The monitor changed')
      }
      return { ...def, monitor: { ...def.monitor, path: change.to } }
    }
    case 'savePath':
      return { ...def, savePath: change.to }
  }
}
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
          const ids = new Set<string>()
          for (const change of plan.configs) {
            const where = and(
              eq(gameLaunchConfigs.id, change.id),
              eq(gameLaunchConfigs.gameId, work.id),
            )
            const row = write.db
              .select({ definition: gameLaunchConfigs.definition })
              .from(gameLaunchConfigs)
              .where(where)
              .get()
            if (row?.definition.status !== 'ready') {
              throw new DesktopError('Conflict', 'A selected configuration is no longer available')
            }
            write.db
              .update(gameLaunchConfigs)
              .set({
                definition: ready(setConfigPath(row.definition.value, change)),
                updatedAt: write.now,
              })
              .where(where)
              .run()
            ids.add(change.id)
          }
          if (ids.size) {
            write.changes.push({
              type: 'holdingsChanged',
              work: { type: 'game', id: work.id },
              launchConfigIds: [...ids],
            })
          }
        }
        if (work.type === 'anime') {
          for (const change of plan.subtitles) {
            const where = and(eq(animeFiles.id, change.id), eq(animeFiles.animeId, work.id))
            const row = write.db
              .select({ choices: animeFiles.playbackChoices })
              .from(animeFiles)
              .where(where)
              .get()
            if (row?.choices.status !== 'ready') {
              throw new DesktopError('Conflict', 'The saved subtitle choice changed')
            }
            const choice = row.choices.value.subtitleTrack
            if (choice?.type !== 'external' || choice.path !== change.from) {
              throw new DesktopError('Conflict', 'The saved subtitle path changed')
            }
            const next: FilePlaybackChoices = {
              ...row.choices.value,
              subtitleTrack: { ...choice, path: change.to },
            }
            write.db
              .update(animeFiles)
              .set({ playbackChoices: ready(next), updatedAt: write.now })
              .where(where)
              .run()
            fileChange(write, { type: 'anime', id: work.id }, [change.id])
          }
        }
      }),
  }
}

export function createDirectoryRelocation(
  call: DatabaseCall<
    ReturnType<typeof holdingStorage> &
      ReturnType<typeof configStorage> &
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
      const requested = new Set<string>()
      for (const selection of request.gameConfigFields ?? []) {
        const config = await call('getGameConfig', work.id, selection.launchConfigId, true)
        if (config?.definition.status !== 'ready') {
          throw new DesktopError(
            'InvalidReference',
            'A selected launch configuration cannot be read',
          )
        }
        for (const field of selection.fields) {
          const target = { type: 'launchConfig' as const, id: config.id, field }
          const key = JSON.stringify(target)
          if (requested.has(key)) {
            continue
          }
          requested.add(key)
          const original = configPath(config.definition.value, field)
          if (!original?.path) {
            throw new DesktopError(
              'InvalidInput',
              'The requested configuration field has no saved file path',
            )
          }
          try {
            const to = await verified(original.path, original.kind)
            if (to) {
              plan.configs.push({ id: config.id, field, from: original.path, to })
            }
          } catch (cause) {
            issue(target, original.path, cause)
          }
        }
      }
    }
    if (work.type === 'anime') {
      const selected = new Set<string>()
      for (const selection of request.subtitlePaths ?? []) {
        const file = await call(
          'readWorkFile',
          { type: 'anime', id: work.id },
          selection.fileId,
          true,
        )
        if (!file || !('playbackChoices' in file) || file.playbackChoices.status !== 'ready') {
          throw new DesktopError('InvalidReference', 'The selected subtitle file is unavailable')
        }
        for (const original of selection.paths) {
          const choice = file.playbackChoices.value.subtitleTrack
          if (choice?.type !== 'external' || choice.path !== original) {
            throw new DesktopError('Conflict', 'The chosen path is no longer the saved subtitle')
          }
          if (selected.has(file.id)) {
            continue
          }
          selected.add(file.id)
          try {
            const to = await verified(original, 'file')
            if (to) {
              plan.subtitles.push({ id: file.id, from: original, to })
            }
          } catch (cause) {
            issue({ type: 'subtitle', fileId: file.id, path: original }, original, cause)
          }
        }
      }
    }
    signal.throwIfAborted()
    const uses: UseTarget[] = [
      ...plan.files.map((f) => ({ type: 'file' as const, kind: work.type, id: f.id })),
      ...plan.subtitles.map((f) => ({ type: 'file' as const, kind: 'anime', id: f.id })),
      ...plan.configs.map((c) => ({ type: 'configuration' as const, kind: 'game', id: c.id })),
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
