import type { GraphEntryRef, GraphRelations } from '@kisaki3/desktop-contracts/library'
import { writeRelationBatch } from '../relations/batch'
import type { LibraryWrite } from '../transaction'
import type { GraphReferences } from './references'

export function writeGraphRelations(
  write: LibraryWrite,
  input: GraphRelations,
  refs: GraphReferences,
) {
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
  return writeRelationBatch(write, input, endpoints)
}
