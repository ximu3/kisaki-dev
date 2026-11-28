import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  FileRecognitionProfileFields,
  FileWorkType,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import { eq, max } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import type { Storage } from '../../../../../infrastructure/database'
import { ready } from '../../../../../infrastructure/database/codecs/json'
import * as schema from '../../../../../infrastructure/database/schema'
import { orderedIds } from '../../../ordering'
import { expectFields } from '../../../transaction'
import { directories } from '../../directories/tables'

export type Fields = FileRecognitionProfileFields<FileWorkType>

export function profileStorage(storage: Storage) {
  return {
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
  }
}

export const profiles = {
  anime: schema.animeFileRecognitionProfiles,
  comic: schema.comicFileRecognitionProfiles,
  novel: schema.novelFileRecognitionProfiles,
} as const
