import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { HoldingsRelocationResult, FileWorkType } from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../../infrastructure/files'
import type { ChangeAdmission } from '../../../../infrastructure/use-targets'
import type { CompleteWrite } from '../../transaction'
import { existingPosition } from '../positions'
import { inspectTarget } from '../registration'
import type { FileWork } from './storage'
import { fileError } from '../discover'
import type { holdingStorage } from '../storage'

export function relocationStatus(cause: unknown): 'unverified' | 'unavailable' | 'conflict' {
  if (cause instanceof DesktopError && cause.code === 'PathConflict') {
    return 'conflict'
  }
  if (cause instanceof DesktopError && cause.code === 'PathUnresolved') {
    return 'unverified'
  }
  for (let error = cause; error instanceof Error; error = error.cause) {
    if ('code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return 'unverified'
    }
  }
  return 'unavailable'
}
export function createFileRelocation(
  call: DatabaseCall<ReturnType<typeof holdingStorage>>,
  complete: CompleteWrite,
  native: NativeFiles,
  resources: string,
  admit: ChangeAdmission,
  positionsChanged: () => void,
) {
  return async (
    work: FileWork,
    id: string,
    destination: string,
    expected: string | undefined,
    signal: AbortSignal,
  ): Promise<HoldingsRelocationResult<FileWorkType>> => {
    const path = normalizeAbsolutePath(destination),
      before = await call('libraryPositions', work)
    const old = before.find((p) => p.kind !== 'directory' && p.id === id)
    if (!old) {
      throw new DesktopError('InvalidReference', 'The file is no longer registered to this work')
    }
    if (expected !== undefined && old.path !== expected) {
      throw new DesktopError('Conflict', 'The file moved since it was selected')
    }
    const target = { type: 'file' as const, id }
    let facts
    try {
      facts = await inspectTarget(work.type, path, resources, signal)
      if ((old.kind === 'pages') !== (facts.kind === 'directory')) {
        throw new DesktopError('InvalidInput', 'The new location has a different kind of content')
      }
      if (
        await existingPosition(
          before.filter((p) => p !== old),
          work,
          { path, kind: old.kind },
          native,
          signal,
        )
      ) {
        throw new DesktopError('PathConflict', 'Another file is already registered here')
      }
    } catch (cause) {
      signal.throwIfAborted()
      return {
        work,
        updated: [],
        issues: [{ target, path, status: relocationStatus(cause), error: fileError(cause) }],
      } as HoldingsRelocationResult<FileWorkType>
    }
    signal.throwIfAborted()
    if (path === old.path) {
      return { work, updated: [], issues: [] } as HoldingsRelocationResult<FileWorkType>
    }
    complete(
      await admit([{ type: 'file', kind: work.type, id }], () =>
        call('relocateWorkFile', work, id, path, facts, before),
      ),
    )
    positionsChanged()
    return {
      work,
      updated: [{ target, from: old.path, to: path }],
      issues: [],
    } as HoldingsRelocationResult<FileWorkType>
  }
}
