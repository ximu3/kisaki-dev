import { randomUUID } from 'node:crypto'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  GraphEntryRef,
  GraphPartRef,
  GraphTagRef,
  EntryRef,
  EntryType,
  PartRef,
  PartType,
  LibraryWriteGraph,
} from '@kisaki3/desktop-contracts/library'

export function graphIds(graph: LibraryWriteGraph) {
  return {
    entries: Object.fromEntries(
      (graph.entries?.create ?? []).map((node) => [
        node.key,
        { type: node.type, id: randomUUID() },
      ]),
    ) as Record<string, EntryRef>,
    parts: Object.fromEntries(
      (graph.parts?.create ?? []).map((node) => [node.key, { type: node.type, id: randomUUID() }]),
    ) as Record<string, PartRef>,
  }
}
export type GraphIds = ReturnType<typeof graphIds>
export function references(ids: GraphIds, tags: Map<string, string>) {
  function required<T>(value: T | undefined) {
    if (value === undefined) {
      throw new DesktopError('InvalidReference', 'The graph key has no matching creation')
    }
    return value
  }
  return {
    entry<T extends EntryType>(ref: GraphEntryRef<T>): EntryRef<T> {
      return 'key' in ref ? (required(ids.entries[ref.key]) as EntryRef<T>) : ref
    },
    part<T extends PartType>(ref: GraphPartRef<T>): PartRef<T> {
      return 'key' in ref ? (required(ids.parts[ref.key]) as PartRef<T>) : ref
    },
    tag(ref: GraphTagRef) {
      return 'key' in ref ? required(tags.get(ref.key)) : ref.id
    },
  }
}
export type GraphReferences = ReturnType<typeof references>
