import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { GraphRelations, GraphEntryRef } from '@kisaki3/desktop-contracts/library'
import { workPersonLinks } from '../../../infrastructure/database/schema'
import type { LibraryWrite } from '../transaction'
import {
  findRelation,
  fact,
  readFact,
  relationTables,
  type Relation,
  type RelationKind,
} from '../relations/facts'
import { editedRelation, removeRelation, savedPositions, saveRelation } from '../relations/write'
import { type RelationPositions } from '../relations/order'
import type { GraphReferences } from './references'

function snapshot(row: Relation) {
  const { id, note, ...fields } = row.value
  const binding = { ...fields }
  Reflect.deleteProperty(binding, 'isSpoiler')
  return { id, binding, note, ...('isSpoiler' in fields && { isSpoiler: fields.isSpoiler }) }
}
function castKey(row: Relation) {
  if (row.kind === 'workCharacter') {
    return JSON.stringify([row.value.work.id, row.value.character.id])
  }
  if (row.kind === 'personWork' && row.value.character) {
    return JSON.stringify([row.value.work.id, row.value.character.id])
  }
  return null
}
interface Edit {
  before: Relation
  after: Relation
  positions: RelationPositions
  stage: boolean
}
export function writeGraphRelations(
  write: LibraryWrite,
  input: GraphRelations,
  refs: GraphReferences,
) {
  const regions = {
    workCharacters: 'workCharacter',
    personWorks: 'personWork',
    organizationWorks: 'organizationWork',
    workRelations: 'workRelation',
  } as const
  const { db } = write
  const added: Relation[] = [],
    removed: Relation[] = [],
    edits: Edit[] = []
  function endpoints(fields: object) {
    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        ['work', 'person', 'character', 'organization', 'from', 'to'].includes(key) && value
          ? refs.entry(value as GraphEntryRef)
          : value,
      ]),
    )
  }
  function read(kind: RelationKind, id: string) {
    const row = readFact(db, kind, id)
    if (!row) {
      throw new DesktopError('NotFound', 'The selected relationship no longer exists')
    }
    return row
  }
  for (const [region, kind] of Object.entries(regions)) {
    const actions = input[region as keyof typeof regions]
    if (!actions) {
      continue
    }
    for (const expected of actions.expected ?? []) {
      if (!isDeepStrictEqual(snapshot(read(kind, expected.id)), expected)) {
        throw new DesktopError('Conflict', 'A relationship selected for removal has changed')
      }
    }
    for (const id of actions.remove ?? []) {
      removed.push(read(kind, id))
    }
    for (const item of actions.update ?? []) {
      const before = read(kind, item.id),
        after = editedRelation(before, {
          changes: endpoints(item.changes),
          ...(item.expected && { expected: item.expected }),
        })
      if (!isDeepStrictEqual(before, after)) {
        edits.push({
          before,
          after,
          positions: savedPositions(db, before),
          stage: !isDeepStrictEqual(snapshot(before).binding, snapshot(after).binding),
        })
      }
    }
    for (const item of actions.add ?? []) {
      const row = fact(kind, randomUUID(), endpoints(item)),
        id = findRelation(db, row)
      if (id && (actions.remove?.includes(id) || actions.update?.some((edit) => edit.id === id))) {
        throw new DesktopError('InvalidInput', 'Contradictory relationship intentions')
      }
      if (!id) {
        added.push(row)
      }
    }
  }
  const lostCast = new Set(
    [
      ...removed.filter((row) => row.kind === 'workCharacter'),
      ...edits
        .filter(
          (edit) =>
            edit.before.kind === 'workCharacter' && castKey(edit.before) !== castKey(edit.after),
        )
        .map((edit) => edit.before),
    ].map(castKey),
  )
  for (const row of [...added, ...edits.map((edit) => edit.after)]) {
    if (row.kind === 'personWork' && lostCast.has(castKey(row))) {
      throw new DesktopError('Conflict', 'The credit still requires the previous character binding')
    }
  }

  for (const row of removed.filter((row) => row.kind === 'personWork')) {
    removeRelation(write, row.kind, row.value.id)
  }
  function detach(edit: Edit) {
    const table = relationTables[edit.before.kind]
    db.delete(table).where(eq(table.id, edit.before.value.id)).run()
  }
  for (const edit of edits) {
    if (edit.stage && edit.before.kind === 'personWork') {
      detach(edit)
    }
  }
  for (const edit of edits) {
    if (!edit.stage || edit.before.kind === 'personWork') {
      continue
    }
    if (edit.before.kind === 'workCharacter') {
      if (castKey(edit.before) === castKey(edit.after)) {
        edit.stage = false
        continue
      }
      const { work, character } = edit.before.value
      if (
        db
          .select({ id: workPersonLinks.id })
          .from(workPersonLinks)
          .where(
            and(eq(workPersonLinks.workId, work.id), eq(workPersonLinks.characterId, character.id)),
          )
          .limit(1)
          .get()
      ) {
        throw new DesktopError(
          'Conflict',
          'Move or remove the dependent character credits explicitly',
        )
      }
    }
    detach(edit)
  }
  for (const row of removed.filter((row) => row.kind !== 'personWork')) {
    removeRelation(write, row.kind, row.value.id)
  }
  for (const kind of Object.values(regions)) {
    for (const edit of edits.filter((edit) => edit.after.kind === kind)) {
      saveRelation(write, edit.after, !edit.stage, edit.stage ? edit.positions : undefined)
    }
    for (const row of added.filter((row) => row.kind === kind)) {
      saveRelation(write, row, false)
    }
  }
}
