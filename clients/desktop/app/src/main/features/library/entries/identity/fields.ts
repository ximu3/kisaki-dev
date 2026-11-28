import { eq } from 'drizzle-orm'
import { parseEntryUpdate, type EntryRef } from '@kisaki3/desktop-contracts/library'
import { entries, entryExternalIdentities } from '../../../../infrastructure/database/schema'
import { catalogTables, entryWhere } from '../tables'
import { updateEntry } from '../write'
import type { LibraryWrite } from '../../transaction'

export function mergeText(kept: string | null, source: string | null) {
  return (
    [...new Set([kept, source].filter((s): s is string => s !== null && !!s.trim()))].join(
      '\n\n',
    ) || null
  )
}
export function mergeFields(write: LibraryWrite, source: EntryRef, target: EntryRef) {
  const { db } = write,
    table = catalogTables[target.type]
  function fields(ref: EntryRef) {
    return {
      ...db.select().from(entries).where(entryWhere(ref)).get(),
      ...db.select().from(table).where(eq(table.entryId, ref.id)).get(),
    }
  }
  const before = fields(target),
    from = fields(source),
    changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(from)) {
    if (['id', 'entryId', 'type', 'createdAt', 'updatedAt'].includes(key)) {
      continue
    }
    const saved: unknown = Reflect.get(before, key)
    if (key === 'aliases' && Array.isArray(saved) && Array.isArray(value)) {
      changes.aliases = [...new Set([...(saved as string[]), ...(value as string[])])]
      continue
    }
    if (
      (saved === null || saved === '' || (Array.isArray(saved) && !saved.length)) &&
      value !== null
    ) {
      changes[key] = value
    }
  }
  updateEntry(write, parseEntryUpdate({ ref: target, changes }))
  db.update(entryExternalIdentities)
    .set({ ownerId: target.id })
    .where(eq(entryExternalIdentities.ownerId, source.id))
    .run()
}
