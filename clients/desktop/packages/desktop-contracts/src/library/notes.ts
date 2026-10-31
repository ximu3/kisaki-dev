/** @fileoverview Defines independently saved private notes and their two-sided entry memberships. */

import * as v from 'valibot'
import type { CallOptions, ListOptions, ListResult } from '../execution'
import { preparedAttachmentSchema, type PreparedAttachment } from '../resources'
import { objectSchema } from '../schema'
import {
  exactPartialEntries,
  hasRelatedExpected,
  hasUniqueKeys,
  nonemptyStringSchema,
  parseContract,
} from '../validation'
import { entryRefSchema, type EntryRef } from './identity'
import type { MoveInput, OrderChange } from './ordering'

/** A private article with independent identity; related entries are an ordered explicit membership. */
export interface Note {
  readonly id: string
  readonly title: string | null
  readonly content: string
  readonly primaryImageId: string | null
  readonly entries: readonly EntryRef[]
  readonly createdAt: number
  readonly updatedAt: number
}
/** A bounded list does not transport complete Markdown articles. */
export interface NoteSummary {
  readonly id: string
  readonly title: string | null
  readonly contentExcerpt: string | null
  readonly primaryImageId: string | null
  readonly createdAt: number
  readonly updatedAt: number
}
/** A new note requires a title, nonblank content, or adopted cover; membership alone is insufficient. */
export interface NoteCreate {
  readonly title?: string | null
  readonly content?: string
  readonly primaryImageId?: string | null
  readonly entries?: readonly EntryRef[]
  readonly prepared?: readonly PreparedAttachment[]
}
/** Title/content/cover and a replaced ordered membership compare independently within one save. */
export interface NoteUpdate {
  readonly changes: Omit<NoteCreate, 'prepared'>
  readonly expected?: {
    readonly title?: string | null
    readonly content?: string
    readonly primaryImageId?: string | null
    readonly entries?: readonly EntryRef[]
  }
  readonly prepared?: readonly PreparedAttachment[]
}
export interface NoteQuery {
  readonly search: string
  readonly scope:
    { readonly type: 'library' | 'unlinked' } | { readonly type: 'entry'; readonly entry: EntryRef }
}
/** Only one actual side's order changes; the opposite side's order and content timestamps are preserved. */
export type NoteOrderScope =
  | { readonly type: 'note'; readonly noteId: string }
  | { readonly type: 'entry'; readonly entry: EntryRef }
/** Explicit whole-note replacement or membership add/remove intent, never a filtered-list overwrite. */
export type NoteEntriesChange =
  | { readonly type: 'replace'; readonly items: readonly EntryRef[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryRef[]
      readonly remove?: readonly EntryRef[]
    }

/** Private articles remain readable after their final entry link is removed. */
export interface NotesApi {
  /** Read summaries and total in the actual library or entry-side order. */
  list(query: NoteQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<NoteSummary>>
  /** Read the complete saved article or null; opening an editor does not create one. */
  get(id: string, call?: CallOptions): Promise<Note | null>
  /** Save content, adopted attachments, and initial ordered links atomically. */
  create(input: NoteCreate, call?: CallOptions): Promise<string>
  /** Save only explicit changes; already saved notes may be cleared without being implicitly deleted. */
  update(id: string, input: NoteUpdate, call?: CallOptions): Promise<void>
  /** Delete the note and its links, retaining unrelated entries and user files. */
  delete(id: string, call?: CallOptions): Promise<void>
  readonly entries: {
    /** Commit explicit membership intent independently of the article's content fields. */
    applyChanges(
      noteId: string,
      input: {
        readonly change: NoteEntriesChange
        readonly expected?: { readonly entries: readonly EntryRef[] }
      },
      call?: CallOptions,
    ): Promise<void>
    /** Apply a full or subset permutation on one actual side against its full baseline. */
    reorder(scope: NoteOrderScope, input: OrderChange, call?: CallOptions): Promise<void>
    /** Move only the explicit current members before a current anchor. */
    move(scope: NoteOrderScope, input: MoveInput, call?: CallOptions): Promise<void>
  }
}

const noteFields = {
  title: v.pipe(
    v.nullable(v.string()),
    v.transform((value) => (value === null || value.trim() === '' ? null : value)),
  ),
  content: v.string(),
  primaryImageId: v.nullable(nonemptyStringSchema),
  entries: v.pipe(
    v.array(entryRefSchema),
    v.check((values) => hasUniqueKeys(values, (value) => value.id)),
    v.readonly(),
  ),
}
const prepared = v.exactOptional(v.pipe(v.array(preparedAttachmentSchema), v.readonly()))

/** Validate a real create intent; attachments still require ownership and adoption checks at commit. */
export function parseNoteCreate(input: unknown): NoteCreate {
  return parseContract(
    v.pipe(
      objectSchema({ ...exactPartialEntries(noteFields), prepared }),
      v.check((value) => Boolean(value.title || value.content?.trim() || value.primaryImageId)),
    ),
    input,
    'note creation',
  )
}
/** Validate a partial save without treating a missing field as a request to clear it. */
export function parseNoteUpdate(input: unknown): NoteUpdate {
  const fields = objectSchema(exactPartialEntries(noteFields))
  return parseContract(
    v.pipe(
      objectSchema({ changes: fields, expected: v.exactOptional(fields), prepared }),
      v.check((value) => hasRelatedExpected(value.changes, value.expected)),
    ),
    input,
    'note update',
  )
}
