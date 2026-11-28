import { eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parsePartCreate,
  type PartRef,
  type PartKindChange,
} from '@kisaki3/desktop-contracts/library'
import { expectFields, type LibraryWrite } from '../../transaction'
import { parts } from '../tables'
import { getPart, requirePart, insertPart } from '../write'
import { releasePartImages } from '../images'

export function correctAnimeKind(
  write: LibraryWrite,
  ref: PartRef<'animeEpisode' | 'animeExtra'>,
  input: PartKindChange,
) {
  const current = requirePart(write.db, ref)
  const from = parts[ref.type],
    to = parts[input.target.kind]
  expectFields(current.data, input.expected)
  const data: Record<string, unknown> = {
    ...current.data,
    ...input.changes,
    type: input.target.type,
  }
  delete data.numberLabel
  if (input.target.kind === 'animeEpisode') {
    data.numberLabel = input.target.numberLabel
  }

  const firstEvent = write.changes.length
  if (getPart(write.db, { id: ref.id, type: input.target.kind })) {
    throw new DesktopError('Conflict', 'The destination kind already contains this identity')
  }
  const create = parsePartCreate({
    type: input.target.kind,
    work: current.work,
    data,
    completed: current.completed,
  })
  insertPart(write, create, ref.id, current.createdAt)
  const links = write.db.select().from(from.files).where(eq(from.files.partId, ref.id)).all()
  for (const link of links) {
    write.db.insert(to.files).values(link).run()
  }
  write.db.run(
    sql`update ${from.activity} set ${sql.identifier(from.activityPart.name)}=null,${sql.identifier(to.activityPart.name)}=${ref.id} where ${from.activityPart}=${ref.id}`,
  )
  releasePartImages(write, current)
  write.db.delete(from.table).where(eq(from.table.id, ref.id)).run()
  write.changes.splice(firstEvent)
  const next = { type: input.target.kind, id: ref.id }
  write.changes.push({
    type: 'partKindChanged',
    fromPart: ref,
    toPart: next,
    work: { type: 'anime', id: current.work.id },
  })
  return next
}
