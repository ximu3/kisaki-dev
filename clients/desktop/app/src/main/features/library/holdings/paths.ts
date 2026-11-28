import { isDeepStrictEqual } from 'node:util'
import { eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { WorkRef, RelocatedPathTarget } from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import { registeredRelation as comparePaths } from '../../../infrastructure/files/registered-path'
import type { LibraryDatabase } from '../transaction'
import { directories, mediaFiles } from './tables'

export type PositionKind = 'directory' | 'file' | 'pages'
export interface Position {
  id: string
  path: string
  kind: PositionKind
}

export function positions(db: LibraryDatabase, work: WorkRef): Position[] {
  const dir = directories[work.type]
  const roots = db
    .select({ id: dir.table.id, path: dir.table.path })
    .from(dir.table)
    .where(eq(dir.owner, work.id))
    .orderBy(dir.table.id)
    .all()
    .map((row) => ({ ...row, kind: 'directory' as const }))
  if (work.type === 'game') {
    return roots
  }
  const file = mediaFiles[work.type]
  const kind =
    work.type === 'anime'
      ? sql`'file'`
      : sql`case kind when 'directory' then 'pages' else 'file' end`
  return [
    ...roots,
    ...db.all<Position>(
      sql`select id,path,${kind} kind from ${file.table} where ${file.owner}=${work.id} order by id`,
    ),
  ]
}

export function expectPositions(db: LibraryDatabase, work: WorkRef, before: readonly Position[]) {
  if (!isDeepStrictEqual(positions(db, work), before)) {
    throw new DesktopError('TargetChanged', 'The registered locations changed during inspection')
  }
}

export async function existingPosition(
  list: readonly Position[],
  work: WorkRef,
  at: { path: string; kind: PositionKind },
  native: NativeFiles,
  signal: AbortSignal,
) {
  let existing: string | null = null
  for (const saved of list) {
    if ((saved.kind === 'directory') !== (at.kind === 'directory')) {
      continue
    }
    signal.throwIfAborted()
    const relation = await comparePaths(saved.path, at.path, native)
    if (relation === 'unknown') {
      throw new DesktopError(
        'PathUnresolved',
        'The selected path cannot be compared with ' + saved.path,
      )
    }
    if (relation === 'same') {
      if (existing || saved.kind !== at.kind) {
        throw new DesktopError('PathConflict', 'Conflicting registrations at ' + saved.path)
      }
      existing = saved.id
    }
    if (
      (relation === 'contains' || relation === 'within') &&
      (saved.kind === 'pages' ||
        at.kind === 'pages' ||
        (at.kind === 'directory' && work.type !== 'game'))
    ) {
      throw new DesktopError('PathConflict', 'Overlapping registered locations: ' + saved.path)
    }
  }
  return existing
}

export type VerifyPath = (
  path: string,
  kind: 'file' | 'directory' | 'either',
) => Promise<string | null>
export type ReportPathIssue = (target: RelocatedPathTarget, path: string, cause: unknown) => void
