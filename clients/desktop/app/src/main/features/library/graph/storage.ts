import {
  parseEntryCreate,
  parsePartCreate,
  type LibraryWriteGraph,
  type EntryTagChange,
  type GraphTagChange,
  type GraphTagMember,
  type GraphRelations,
  type GraphPartRef,
  type VolumeChapterChange,
} from '@kisaki3/desktop-contracts/library'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { Storage } from '../../../infrastructure/database'
import { adoptAttachments } from '../../../infrastructure/attachments/storage'
import { commit } from '../transaction'
import { createEntry, updateEntry } from '../entries/write'
import { requireEntry } from '../entries/tables'
import { insertPart, changePart } from '../parts/write'
import { editVolumeMembers } from '../parts/members'
import { addTag, editTag } from '../organizers/catalog'
import { editEntryTags } from '../organizers/entry-memberships'
import { writeGraphRelations } from './relations'
import { references, type GraphIds, type GraphReferences } from './references'
import { registerGraphContent, type prepareRegistrations } from './holdings'

function tagMember(refs: GraphReferences, member: GraphTagMember) {
  return { ...member, tagId: refs.tag(member.tagId) }
}
function tagChange(refs: GraphReferences, input: GraphTagChange): EntryTagChange {
  if (input.type === 'replace') {
    return { type: 'replace', items: input.items.map((item) => tagMember(refs, item)) }
  }
  return {
    type: 'modify',
    ...(input.add && { add: input.add.map((item) => tagMember(refs, item)) }),
    ...(input.remove && { remove: input.remove.map((ref) => refs.tag(ref)) }),
  }
}
type VolumeEdit = NonNullable<GraphRelations['volumeChapters']>[number]
function chapterChange(refs: GraphReferences, change: VolumeEdit['change']): VolumeChapterChange {
  const item = (v: { chapter: GraphPartRef<'comicChapter'>; numberLabel: string | null }) => ({
    chapter: refs.part(v.chapter),
    numberLabel: v.numberLabel,
  })
  if (change.type === 'replace') {
    return { type: 'replace', items: change.items.map(item) }
  }
  return {
    type: 'modify',
    ...(change.add && { add: change.add.map(item) }),
    ...(change.remove && { remove: change.remove.map((v) => refs.part(v)) }),
  }
}
export function graphStorage(storage: Storage) {
  return {
    writeLibraryGraph(
      graph: LibraryWriteGraph,
      ids: GraphIds,
      images: readonly Attachment[],
      registrations: Awaited<ReturnType<typeof prepareRegistrations>>,
    ) {
      return commit(storage, (write) => {
        adoptAttachments(write.db, images)
        const tags = new Map<string, string>(),
          refs = references(ids, tags)
        for (const { key, ...tag } of graph.tags?.create ?? []) {
          tags.set(key, addTag(write, tag))
        }
        for (const { id, ...edit } of graph.tags?.update ?? []) {
          editTag(write, id, edit)
        }
        for (const { key, tags, ...entry } of graph.entries?.create ?? []) {
          createEntry(
            write,
            parseEntryCreate({
              ...entry,
              ...(tags && { tags: tags.map((item) => tagMember(refs, item)) }),
            }),
            ids.entries[key]!.id,
          )
        }
        for (const edit of graph.entries?.update ?? []) {
          updateEntry(write, edit)
        }
        for (const { key, work, ...part } of graph.parts?.create ?? []) {
          insertPart(
            write,
            parsePartCreate({ ...part, work: refs.entry(work) }),
            ids.parts[key]!.id,
          )
        }
        for (const part of graph.parts?.update ?? []) {
          changePart(write, part)
        }
        const relations = graph.relations
        if (relations) {
          writeGraphRelations(write, relations, refs)
          for (const row of relations.entryTags ?? []) {
            const entry = refs.entry(row.entry)
            requireEntry(write.db, entry)
            editEntryTags(write, entry, tagChange(refs, row.change), row.expected)
          }
          for (const row of relations.volumeChapters ?? []) {
            editVolumeMembers(
              write,
              refs.part(row.volume),
              chapterChange(refs, row.change),
              row.expected,
            )
          }
        }
        registerGraphContent(write, registrations)
        return { ...ids, tags: Object.fromEntries(tags), changed: write.changes.length > 0 }
      })
    },
  }
}
