import * as v from 'valibot'
import { id, text, unique } from '../../validation'
import { membershipChangeSchema } from '../membership'
import { entryTagsSchema, entryTypes } from '../catalog'
import { entryKey, partKey, tagKey } from './nodes'
import type { GraphReferences } from './references'

export function tagMemberSchema(tagReference: GraphReferences['tagReference']) {
  return v.strictObject({
    tagId: tagReference,
    note: v.exactOptional(v.nullable(text)),
    isSpoiler: v.exactOptional(v.boolean()),
  })
}

export function membershipEdits(
  { entryReference, partReference, tagReference }: GraphReferences,
  tagMember: ReturnType<typeof tagMemberSchema>,
) {
  const tagChange = membershipChangeSchema(tagMember, tagReference, (item) => item.tagId, tagKey)

  const volume = partReference(['comicVolume'] as const)
  const chapter = partReference(['comicChapter'] as const)
  const chapterMember = v.strictObject({ chapter, numberLabel: v.nullable(text) })
  const chapterChange = membershipChangeSchema(
    chapterMember,
    chapter,
    (item) => item.chapter,
    partKey,
  )
  const existingChapters = v.pipe(
    v.array(
      v.strictObject({
        chapter: v.strictObject({ type: v.literal('comicChapter'), id }),
        numberLabel: v.nullable(text),
      }),
    ),
    v.check((items) => unique(items, (item) => item.chapter.id)),
  )

  return {
    entryTags: v.exactOptional(
      v.pipe(
        v.array(
          v.strictObject({
            entry: entryReference(entryTypes),
            change: tagChange,
            expected: v.exactOptional(entryTagsSchema),
          }),
        ),
        v.check(
          (items) =>
            unique(items, (item) => entryKey(item.entry)) &&
            items.every((item) => item.expected === undefined || item.change.type === 'replace'),
        ),
      ),
    ),
    volumeChapters: v.exactOptional(
      v.pipe(
        v.array(
          v.strictObject({
            volume,
            change: chapterChange,
            expected: v.exactOptional(existingChapters),
          }),
        ),
        v.check(
          (items) =>
            unique(items, (item) => partKey(item.volume)) &&
            items.every((item) => item.expected === undefined || item.change.type === 'replace'),
        ),
      ),
    ),
  }
}
