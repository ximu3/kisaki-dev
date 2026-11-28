import { eq, sql, and } from 'drizzle-orm'
import {
  parsePersonWorkCreate,
  type WorkCharacter,
  type PersonWork,
} from '@kisaki3/desktop-contracts/library'
import { workCharacterLinks, workPersonLinks } from '../../../infrastructure/database/schema'
import type { LibraryDatabase, LibraryWrite } from '../transaction'
import { requireEntry } from '../entries/tables'
import type { RelationOrder } from './order'

export const table = workPersonLinks
export const sides = ['work', 'person', 'character'] as const

export function fact(id: string, raw: unknown): { kind: 'personWork'; value: PersonWork } {
  return {
    kind: 'personWork',
    value: { note: null, isSpoiler: false, ...parsePersonWorkCreate(raw), id },
  }
}

export function read(db: LibraryDatabase, id: string): ReturnType<typeof fact> | null {
  const r = db.select().from(workPersonLinks).where(eq(workPersonLinks.id, id)).get()
  return r
    ? fact(id, {
        work: { id: r.workId, type: r.workType },
        person: { type: 'person', id: r.personId },
        character: r.characterId ? { type: 'character', id: r.characterId } : null,
        role: r.role,
        note: r.note,
        isSpoiler: r.isSpoiler,
      })
    : null
}

export function snapshot(value: PersonWork) {
  const binding = { ...value }
  Reflect.deleteProperty(binding, 'note')
  Reflect.deleteProperty(binding, 'isSpoiler')
  return { type: 'personWork', ...binding } as const
}

export function find(db: LibraryDatabase, value: PersonWork) {
  const where = sql`work_id=${value.work.id} and person_id=${value.person.id} and character_id is ${value.character?.id ?? null} and role=${value.role}`
  return db.get<{ id: string }>(sql`select id from ${workPersonLinks} where ${where}`)?.id
}

export function persist(
  write: LibraryWrite,
  value: PersonWork,
  update: boolean,
  order: RelationOrder,
  addCast: (work: PersonWork['work'], character: NonNullable<PersonWork['character']>) => void,
) {
  const { db } = write
  const { work, person, character, id, role, note, isSpoiler } = value
  requireEntry(db, work)
  requireEntry(db, person)
  if (character) {
    requireEntry(db, character)
    const exists = db
      .select({ id: workCharacterLinks.id })
      .from(workCharacterLinks)
      .where(
        and(
          eq(workCharacterLinks.workId, work.id),
          eq(workCharacterLinks.characterId, character.id),
        ),
      )
      .get()
    if (!exists) {
      addCast(work, character)
    }
  }
  const fields = {
    workId: work.id,
    workType: work.type,
    personId: person.id,
    characterId: character?.id ?? null,
    role,
    note,
    isSpoiler,
    orderInWork: order(
      workPersonLinks,
      workPersonLinks.orderInWork,
      workPersonLinks.workId,
      work.id,
    ),
    orderInPerson: order(
      workPersonLinks,
      workPersonLinks.orderInPerson,
      workPersonLinks.personId,
      person.id,
    ),
    orderInCharacter: character
      ? order(
          workPersonLinks,
          workPersonLinks.orderInCharacter,
          workPersonLinks.characterId,
          character.id,
        )
      : null,
  }
  if (update) {
    db.update(workPersonLinks).set(fields).where(eq(workPersonLinks.id, id)).run()
  } else {
    db.insert(workPersonLinks)
      .values({ id, ...fields })
      .run()
  }
}

export function recordRemovedCredits(write: LibraryWrite, character: WorkCharacter) {
  const work = write.db
    .select({ id: workPersonLinks.id })
    .from(workPersonLinks)
    .where(
      and(
        eq(workPersonLinks.workId, character.work.id),
        eq(workPersonLinks.characterId, character.character.id),
      ),
    )
    .all()
  for (const item of work) {
    const lost = read(write.db, item.id)!
    write.changes.push({ type: 'relationDeleted', relation: snapshot(lost.value) })
  }
}
