import { eq, sql } from 'drizzle-orm'
import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  fact,
  readFact,
  relationTables,
  binding,
  findRelation,
  type Relation,
  type RelationKind,
} from '../../relations/facts'
import { savedPositions, saveRelation, type RelationPositions } from '../../relations/write'
import type { LibraryWrite } from '../../transaction'
import { mergeText } from './fields'

export function mergeEntryRelations(write: LibraryWrite, from: EntryRef, to: EntryRef) {
  const { db } = write
  const sides = {
    workCharacter: ['work', 'character'],
    personWork: ['work', 'character', 'person'],
    organizationWork: ['work', 'organization'],
    workRelation: ['from', 'to'],
  } as const
  const affected: { before: Relation; after: Relation; positions: RelationPositions }[] = []
  for (const kind of Object.keys(sides) as RelationKind[]) {
    const where = sides[kind].map((side) => sql`${sql.identifier(side + '_id')}=${from.id}`)
    const ids = db.all<{ id: string }>(
      sql`select id from ${relationTables[kind]} where ${sql.join(where, sql` or `)} order by id`,
    )
    for (const { id } of ids) {
      const before = readFact(db, kind, id)!,
        fields = Object.fromEntries(
          Object.entries<unknown>({ ...before.value })
            .filter(([key]) => key !== 'id')
            .map(([key, value]) => [
              key,
              typeof value === 'object' && value !== null && 'id' in value && value.id === from.id
                ? to
                : value,
            ]),
        )
      if (kind === 'workRelation' && (fields.from as EntryRef).id === (fields.to as EntryRef).id) {
        throw new DesktopError('Conflict', 'The merge would relate a work to itself: ' + id)
      }
      affected.push({
        before,
        after: fact(kind, id, fields),
        positions: savedPositions(db, before),
      })
    }
  }
  // Detach credits before changing the cast keys referenced by their foreign keys.
  for (const kind of ['personWork', 'workCharacter', 'organizationWork', 'workRelation'] as const) {
    const table = relationTables[kind]
    for (const row of affected.filter((r) => r.before.kind === kind)) {
      db.delete(table).where(eq(table.id, row.before.value.id)).run()
    }
  }
  for (const { before, after, positions } of affected) {
    const id = findRelation(db, after)
    if (!id) {
      saveRelation(write, after, false, positions)
      continue
    }
    const kept = readFact(db, after.kind, id)!,
      fields = { ...kept.value }
    Reflect.deleteProperty(fields, 'id')
    const merged = fact(after.kind, id, {
      ...fields,
      note: mergeText(kept.value.note, after.value.note),
      ...('isSpoiler' in kept.value &&
        'isSpoiler' in after.value && { isSpoiler: kept.value.isSpoiler || after.value.isSpoiler }),
    })
    write.changes.push({ type: 'relationDeleted', relation: binding(before) })
    saveRelation(write, merged, true)
  }
}
