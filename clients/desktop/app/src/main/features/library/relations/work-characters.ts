import { eq, sql, and } from 'drizzle-orm'
import { parseWorkCharacterCreate, type WorkCharacter } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { workCharacterLinks, workPersonLinks } from '../../../infrastructure/database/schema'
import type { LibraryDatabase, LibraryWrite } from '../transaction'
import { requireEntry } from '../entries/tables'
import type { RelationOrder } from './order'

export const table = workCharacterLinks
export const sides = ['work', 'character'] as const

export function fact(id: string, raw: unknown): { kind: 'workCharacter'; value: WorkCharacter } {
  return {
    kind: 'workCharacter',
    value: { note: null, isSpoiler: false, ...parseWorkCharacterCreate(raw), id },
  }
}

export function read(db: LibraryDatabase, id: string): ReturnType<typeof fact> | null {
  const r = db.select().from(workCharacterLinks).where(eq(workCharacterLinks.id, id)).get()
  return r
    ? {
        kind: 'workCharacter',
        value: {
          id: r.id,
          work: { id: r.workId, type: r.workType },
          character: { type: 'character', id: r.characterId },
          role: r.role,
          note: r.note,
          isSpoiler: r.isSpoiler,
        },
      }
    : null
}

export function snapshot({ id, work, character, role }: WorkCharacter) {
  return { type: 'workCharacter', id, work, character, role } as const
}

export function find(db: LibraryDatabase, value: WorkCharacter) {
  const where = sql`work_id=${value.work.id} and character_id=${value.character.id}`
  return db.get<{ id: string }>(sql`select id from ${workCharacterLinks} where ${where}`)?.id
}

export function persist(
  write: LibraryWrite,
  value: WorkCharacter,
  update: boolean,
  order: RelationOrder,
) {
  const { db } = write
  const { work, character, id, role, note, isSpoiler } = value
  requireEntry(db, work)
  requireEntry(db, character)
  const fields = {
    workId: work.id,
    workType: work.type,
    characterId: character.id,
    role,
    note,
    isSpoiler,
    orderInWork: order(
      workCharacterLinks,
      workCharacterLinks.orderInWork,
      workCharacterLinks.workId,
      work.id,
    ),
    orderInCharacter: order(
      workCharacterLinks,
      workCharacterLinks.orderInCharacter,
      workCharacterLinks.characterId,
      character.id,
    ),
  }
  if (update) {
    db.update(workCharacterLinks).set(fields).where(eq(workCharacterLinks.id, id)).run()
  } else {
    db.insert(workCharacterLinks)
      .values({ id, ...fields })
      .run()
  }
}

export function checkCreditBindings(
  db: LibraryDatabase,
  before: WorkCharacter,
  after: WorkCharacter,
) {
  if (before.work.id === after.work.id && before.character.id === after.character.id) {
    return
  }
  const depends = db
    .select({ id: workPersonLinks.id })
    .from(workPersonLinks)
    .where(
      and(
        eq(workPersonLinks.workId, before.work.id),
        eq(workPersonLinks.characterId, before.character.id),
      ),
    )
    .limit(1)
    .get()
  if (depends) {
    throw new DesktopError('Conflict', 'Move or remove the dependent character credits explicitly')
  }
}
