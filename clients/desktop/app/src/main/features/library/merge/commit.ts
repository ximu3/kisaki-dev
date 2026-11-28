import {
  isWorkType,
  type EntryIdentitySnapshot,
  type EntryMergeInput,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { eq, sql } from 'drizzle-orm'
import type { Storage } from '../../../infrastructure/database'
import { entries } from '../../../infrastructure/database/schema'
import { retireImages } from '../attachments/release'
import { verify, type UseTarget } from '../change-admission'
import { mergeFields } from '../entries/merge'
import { snapshot } from '../entries/snapshot'
import { moveDirectories } from '../holdings/directories/write'
import { moveWorkFiles } from '../holdings/files/merge'
import { moveBackups } from '../holdings/game/backups'
import { moveLaunchConfigs } from '../holdings/game/launch-configs/storage'
import type { MergeLocations } from '../holdings/merge'
import { expectPositions } from '../holdings/paths'
import { movePreferences } from '../holdings/preferences'
import { moveCollectionMembers } from '../organizers/collections/memberships'
import { redirectCollectionRules } from '../organizers/collections/rules'
import { moveEntryTags } from '../organizers/tags/applications'
import { moveParts } from '../parts/move'
import { moveWorkActivities } from '../records/activities/references'
import { moveWorkAnnotations } from '../records/annotations/references'
import { moveCompletions } from '../records/completions/write'
import { moveNoteLinks } from '../records/notes/members'
import { mergeEntryRelations } from '../relations/merge'
import { redirectShowcaseQueries } from '../showcase/queries'
import { commit, type LibraryWrite } from '../transaction'

export function mergeStorage(storage: Storage) {
  return {
    mergeLibraryEntries: (
      input: EntryMergeInput,
      locations: MergeLocations,
      baseline: readonly UseTarget[],
    ) =>
      commit(storage, (write) => {
        const { sources, target } = input,
          { db } = write,
          original = snapshot(db, target)
        verify(write, [target, ...sources], baseline)
        for (const scope of locations.baseline) {
          expectPositions(db, scope.work, scope.positions)
        }
        db.run(sql`pragma defer_foreign_keys=on`)
        const snapshots: EntryIdentitySnapshot[] = []
        for (const source of sources) {
          snapshots.push(snapshot(db, source))
          retireImages(write, source)
          mergeFields(write, source, target)
          moveEntryTags(write, source, target)
          moveCollectionMembers(write, source, target)
          moveNoteLinks(write, source, target)
          mergeEntryRelations(write, source, target)
          if (isWorkType(target.type)) {
            mergeWork(
              write,
              { type: target.type, id: source.id },
              { type: target.type, id: target.id },
              locations,
            )
          }
          redirectCollectionRules(write, source, target, original.name)
          redirectShowcaseQueries(write, source, target, original.name)
          db.delete(entries).where(eq(entries.id, source.id)).run()
        }
        const [first, ...rest] = snapshots
        if (first) {
          write.changes.push({ type: 'entriesMerged', sources: [first, ...rest], target })
        }
        return target
      }),
  }
}

function mergeWork(
  write: LibraryWrite,
  source: WorkRef,
  target: WorkRef,
  locations: MergeLocations,
) {
  moveWorkActivities(write, source, target)
  moveWorkAnnotations(write, source, target)
  moveCompletions(write, source, target)
  moveDirectories(write, source, target)
  if (target.type === 'game') {
    moveLaunchConfigs(write, source, target)
    moveBackups(write, source, target)
    return
  }
  const from = { type: target.type, id: source.id },
    to = { type: target.type, id: target.id }
  moveParts(write, from, to)
  moveWorkFiles(write, from, to, locations.duplicates)
  movePreferences(write, from, to)
}
