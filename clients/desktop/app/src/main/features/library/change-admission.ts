import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  isWorkType,
  partTypes,
  partWorkType,
  type EntryRef,
  type FileWorkType,
  type PartType,
  type WorkType,
} from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import type { Storage } from '../../infrastructure/database'
import * as s from '../../infrastructure/database/schema'
import { mediaFiles } from './holdings/files/tables'
import { parts } from './parts/tables'
import { activityTables } from './records/activities/tables'
import type { LibraryDatabase, LibraryWrite } from './transaction'

export type UseTarget =
  | { readonly type: 'work' | 'activity'; readonly kind: WorkType; readonly id: string }
  | { readonly type: 'file'; readonly kind: FileWorkType; readonly id: string }
  | { readonly type: 'part'; readonly kind: PartType; readonly id: string }
  | { readonly type: 'configuration'; readonly kind: 'game'; readonly id: string }

export type ChangeAdmission = <T>(
  targets: readonly UseTarget[],
  commit: () => Promise<T>,
) => Promise<T>

export function dependencies(db: LibraryDatabase, refs: readonly EntryRef[]) {
  const targets: UseTarget[] = []
  for (const ref of refs) {
    if (!isWorkType(ref.type)) {
      continue
    }
    const work = ref.type
    targets.push({ type: 'work', kind: work, id: ref.id })
    for (const type of partTypes.filter((kind) => partWorkType(kind) === work)) {
      const p = parts[type]
      for (const row of db
        .select({ id: p.table.id })
        .from(p.table)
        .where(eq(p.owner, ref.id))
        .all()) {
        targets.push({ type: 'part', kind: type, id: row.id })
      }
    }
    const activity = activityTables[work]
    for (const row of db
      .select({ id: activity.table.id })
      .from(activity.table)
      .where(eq(activity.owner, ref.id))
      .all()) {
      targets.push({ type: 'activity', kind: work, id: row.id })
    }
    if (work === 'game') {
      for (const c of db
        .select({ id: s.gameLaunchConfigs.id })
        .from(s.gameLaunchConfigs)
        .where(eq(s.gameLaunchConfigs.gameId, ref.id))
        .all()) {
        targets.push({ type: 'configuration', kind: work, id: c.id })
      }
    } else {
      const file = mediaFiles[work]
      for (const f of db
        .select({ id: file.table.id })
        .from(file.table)
        .where(eq(file.owner, ref.id))
        .all()) {
        targets.push({ type: 'file', kind: work, id: f.id })
      }
    }
  }
  return targets.sort(
    (a, b) =>
      a.type.localeCompare(b.type) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
  )
}

export function verify(
  write: LibraryWrite,
  refs: readonly EntryRef[],
  baseline: readonly UseTarget[],
) {
  if (!isDeepStrictEqual(dependencies(write.db, refs), baseline)) {
    throw new DesktopError(
      'TargetChanged',
      'The selected entries acquired or lost dependent records',
    )
  }
}

export function dependencyStorage(storage: Storage) {
  return {
    entryDependencies: (refs: readonly EntryRef[]) =>
      storage.transaction((db) => dependencies(db, refs)),
  }
}
