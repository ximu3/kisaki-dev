import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { eq, max } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  FileRecognitionProfileFields,
  FileRecognitionDefinition,
  FileWorkType,
  FileRecognitionResult,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import type { Storage } from '../../../../infrastructure/database'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { commit, expectFields, type LibraryDatabase } from '../../transaction'
import { orderedIds } from '../../ordering'
import { profiles, directories } from '../tables'
import { fileRow, directLinks, editAssociations, type FileWork } from '../files/storage'
import { candidates, matchParts } from './match'

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
type Fields = FileRecognitionProfileFields<FileWorkType>
export function recognitionStorage(storage: Storage) {
  return {
    recognitionInput: (work: FileWork, id: string) =>
      storage.transaction((db) => recognitionInput(db, work, id)),
    matchCandidates: (work: FileWork) => storage.transaction((db) => candidates(db, work)),
    readRecognitionProfile: (type: FileWorkType, id: string) => {
      const table = profiles[type]
      const row = storage.db.select().from(table).where(eq(table.id, id)).get()
      return row ? { ...row, workType: type } : null
    },
    listRecognitionProfiles: (type: FileWorkType) => {
      const table = profiles[type]
      return storage.db
        .select({ id: table.id, name: table.name, description: table.description })
        .from(table)
        .orderBy(table.sortOrder, table.id)
        .all()
        .map((row) => ({ ...row, workType: type }))
    },
    recognitionReferences(type: FileWorkType, id: string) {
      const { table, owner } = directories[type]
      return storage.db
        .select({ id: owner, directoryId: table.id, path: table.path })
        .from(table)
        .where(eq(table.recognitionProfileId, id))
        .orderBy(table.path, table.id)
        .all()
        .map((row) => ({
          work: { type, id: row.id },
          directoryId: row.directoryId,
          path: row.path,
        }))
    },
    addRecognitionProfile(type: FileWorkType, fields: Fields) {
      return storage.transaction((db) => {
        const table = profiles[type],
          now = Date.now(),
          last =
            db
              .select({ order: max(table.sortOrder) })
              .from(table)
              .get()!.order ?? -1
        const row = db
          .insert(table)
          .values({
            ...fields,
            id: randomUUID(),
            definition: ready(fields.definition),
            createdAt: now,
            updatedAt: now,
            sortOrder: last + 1,
          })
          .returning()
          .get()
        return { ...row, workType: type }
      }, 'immediate')
    },
    editRecognitionProfile(
      type: FileWorkType,
      id: string,
      changes: Partial<Fields>,
      expected?: Partial<Fields>,
    ) {
      return storage.transaction((db) => {
        const table = profiles[type],
          row = db.select().from(table).where(eq(table.id, id)).get()
        if (!row) {
          throw new DesktopError('NotFound', 'The recognition profile no longer exists')
        }
        const original = {
          ...row,
          definition: row.definition.status === 'ready' ? row.definition.value : undefined,
        }
        expectFields(original, expected)
        if (
          Object.entries(changes).every(([key, v]) =>
            isDeepStrictEqual(v, Reflect.get(original, key)),
          )
        ) {
          return { profile: { ...row, workType: type }, changed: false, definitionChanged: false }
        }
        const { definition, ...fields } = changes
        const value = db
          .update(table)
          .set({
            ...fields,
            ...(definition && { definition: ready(definition) }),
            updatedAt: Date.now(),
          })
          .where(eq(table.id, id))
          .returning()
          .get()!
        return {
          profile: { ...value, workType: type },
          changed: true,
          definitionChanged: !!definition && !isDeepStrictEqual(definition, original.definition),
        }
      }, 'immediate')
    },
    removeRecognitionProfile(type: FileWorkType, id: string) {
      return storage.transaction((db) => {
        const table = profiles[type],
          dir = directories[type].table
        if (db.select({ id: dir.id }).from(dir).where(eq(dir.recognitionProfileId, id)).get()) {
          throw new DesktopError('Conflict', 'This recognition profile is used by a directory')
        }
        if (!db.delete(table).where(eq(table.id, id)).run().changes) {
          throw new DesktopError('NotFound', 'The recognition profile no longer exists')
        }
      }, 'immediate')
    },
    orderRecognitionProfiles(type: FileWorkType, input: ReorderInput) {
      return storage.transaction((db) => {
        const table = profiles[type],
          ids = db
            .select({ id: table.id })
            .from(table)
            .orderBy(table.sortOrder, table.id)
            .all()
            .map((row) => row.id)
        const next = orderedIds(ids, input)
        if (isDeepStrictEqual(ids, next)) {
          return false
        }
        next.forEach((id, sortOrder) =>
          db.update(table).set({ sortOrder }).where(eq(table.id, id)).run(),
        )
        return true
      }, 'immediate')
    },
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
