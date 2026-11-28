import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parsePartCreate,
  type PartKindChange,
  type PartRef,
} from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { changePartLinkKind } from '../../holdings/files/associations'
import { movePartActivities } from '../../records/activities/references'
import { expectFields, type LibraryWrite } from '../../transaction'
import { releasePartImages } from '../images'
import { parts } from '../tables'
import { getPart, insertPart, requirePart } from '../write'

export function correctAnimeKind(
  write: LibraryWrite,
  ref: PartRef<'animeEpisode' | 'animeExtra'>,
  input: PartKindChange,
) {
  const current = requirePart(write.db, ref)
  const from = parts[ref.type]
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
  changePartLinkKind(write, ref, input.target.kind)
  movePartActivities(write, ref, { type: input.target.kind, id: ref.id })
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
