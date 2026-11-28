import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  FileRecognitionDefinition,
  FileRecognitionResult,
} from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import type { Storage } from '../../../../infrastructure/database'
import { commit, type LibraryDatabase } from '../../transaction'
import { directories } from '../directories/tables'
import { directLinks, editAssociations } from '../files/associations'
import { fileRow, type FileWork } from '../files/record'
import { candidates } from './candidates'
import { matchParts } from './match'
import { profiles, profileStorage } from './profiles/storage'

export function recognitionInput(db: LibraryDatabase, work: FileWork, id: string) {
  const row = fileRow(db, work, id),
    directory = directories[work.type]
  const roots = db
    .select({
      id: directory.table.id,
      path: directory.table.path,
      profileId: directory.table.recognitionProfileId,
    })
    .from(directory.table)
    .where(eq(directory.owner, work.id))
    .orderBy(directory.table.id)
    .all()
  return {
    file: {
      id: row.id,
      path: row.path,
      kind: 'kind' in row ? row.kind : ('file' as const),
      mode: row.associationMode,
    },
    links: directLinks(db, work, id),
    roots,
  }
}

export function partSet(refs: readonly { type: string; id: string }[]) {
  return new Set(refs.map((ref) => JSON.stringify([ref.type, ref.id])))
}

export interface RecognitionPlan {
  baseline: ReturnType<typeof recognitionInput>
  profileId: string | null
  definition: FileRecognitionDefinition | null
  result: FileRecognitionResult
}

export function recognitionStorage(storage: Storage) {
  return {
    recognitionInput: (work: FileWork, id: string) =>
      storage.transaction((db) => recognitionInput(db, work, id)),
    matchCandidates: (work: FileWork) => storage.transaction((db) => candidates(db, work)),
    ...profileStorage(storage),
    applyFileRecognition: (work: FileWork, plans: readonly RecognitionPlan[], automatic: boolean) =>
      commit(storage, (write) => {
        const changed: string[] = [],
          available = candidates(write.db, work)
        for (const plan of plans) {
          const hit = plan.result
          if (hit.outcome !== 'matched') {
            continue
          }
          if (hit.source.type === 'draft') {
            throw new DesktopError('InvalidInput', 'A draft rule cannot be applied to a file')
          }
          const snapshot = recognitionInput(write.db, work, plan.baseline.file.id)
          if (!isDeepStrictEqual(snapshot, plan.baseline)) {
            throw new DesktopError(
              'TargetChanged',
              'The file or directory changed during recognition',
            )
          }
          if (automatic && (snapshot.file.mode !== 'automatic' || snapshot.links.length)) {
            continue
          }
          if (plan.profileId) {
            const table = profiles[work.type],
              p = write.db
                .select({ definition: table.definition })
                .from(table)
                .where(eq(table.id, plan.profileId))
                .get()
            if (
              p?.definition.status !== 'ready' ||
              !isDeepStrictEqual(p.definition.value, plan.definition)
            ) {
              throw new DesktopError('TargetChanged', 'The recognition rules changed')
            }
          }
          const current = matchParts(work.type, hit.conditions, hit.source, available)
          if (
            current.outcome !== 'matched' ||
            !isDeepStrictEqual(partSet(current.parts), partSet(hit.parts))
          ) {
            throw new DesktopError('TargetChanged', 'The matching parts have changed')
          }
          if (
            isDeepStrictEqual(partSet(snapshot.links.map((row) => row.part)), partSet(hit.parts))
          ) {
            continue
          }
          editAssociations(
            write,
            work,
            snapshot.file.id,
            { change: { type: 'replace', items: hit.parts.map((part) => ({ part })) } },
            false,
          )
          changed.push(snapshot.file.id)
        }
        return changed
      }),
  }
}
