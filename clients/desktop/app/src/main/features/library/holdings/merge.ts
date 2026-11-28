import type { NativeFiles } from '#native'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { isWorkType, type EntryMergeInput, type WorkRef } from '@kisaki3/desktop-contracts/library'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { inspectTarget } from './files/inspect'
import type { DuplicateFile } from './files/merge'
import { existingPosition, type Position } from './paths'
import type { holdingStorage } from './storage'

export interface MergeLocations {
  baseline: { work: WorkRef; positions: Position[] }[]
  duplicates: DuplicateFile[]
}

export async function prepareMergeLocations(
  input: EntryMergeInput,
  call: DatabaseCall<ReturnType<typeof holdingStorage>>,
  native: NativeFiles,
  resources: string,
  signal: AbortSignal,
): Promise<MergeLocations> {
  const result: MergeLocations = { baseline: [], duplicates: [] }
  if (!isWorkType(input.target.type)) {
    return result
  }
  const work = { type: input.target.type, id: input.target.id },
    survivors = await call('libraryPositions', work)
  result.baseline.push({ work, positions: [...survivors] })
  for (const source of input.sources) {
    const ref = { type: work.type, id: source.id },
      positions = await call('libraryPositions', ref)
    result.baseline.push({ work: ref, positions })
    for (const row of positions) {
      signal.throwIfAborted()
      const existing = await existingPosition(survivors, work, row, native, signal)
      if (!existing) {
        survivors.push(row)
        continue
      }
      if (row.kind === 'directory' || work.type === 'game') {
        throw new DesktopError(
          'PathConflict',
          'The merged work would contain duplicate directories: ' + row.path,
        )
      }
      const kept = survivors.find((p) => p.id === existing)!,
        facts = await inspectTarget(work.type, kept.path, resources, signal)
      if ((facts.kind === 'directory') !== (row.kind === 'pages')) {
        throw new DesktopError('TargetChanged', 'The registered file kind has changed: ' + row.path)
      }
      result.duplicates.push({
        sourceWork: source.id,
        sourceFileId: row.id,
        targetFileId: kept.id,
        path: kept.path,
        facts,
      })
    }
  }
  return result
}
