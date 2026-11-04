/** @fileoverview Defines independently saved notes and their explicit, separately ordered entry associations. */

import type { EntryRef } from './catalog'
import type { PreparedAttachment } from '../resources'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import { text, id, unique, parseValue, optionalFields, validateExpectedKeys } from '../validation'
import { entryRefSchema, preparedSchema } from './catalog'
import { DesktopError } from '../errors'

/** The saved article is independent of its associations; body whitespace and empty existing notes are preserved. */
export interface NoteFields {
  readonly title: string | null
  readonly content: string
  readonly primaryImageId: string | null
}

export interface Note extends NoteFields {
  readonly id: string
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

export interface NoteSummary {
  readonly id: string
  readonly title: string | null
  readonly contentExcerpt: string | null
  readonly primaryImageId: string | null
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

export interface NoteCreate {
  readonly title?: string | null
  readonly content?: string
  readonly primaryImageId?: string | null
  readonly entries?: readonly EntryRef[]
  readonly prepared?: readonly PreparedAttachment[]
}

/** Replacing entries compares this note's complete ordered side only; unmodified associations are not compared. */
export interface NoteUpdate {
  readonly changes: Partial<NoteFields> & { readonly entries?: readonly EntryRef[] }
  readonly expected?: Partial<NoteFields> & { readonly entries?: readonly EntryRef[] }
  readonly prepared?: readonly PreparedAttachment[]
}

export interface NoteQuery {
  readonly scope:
    | { readonly type: 'library' | 'unassociated' }
    | { readonly type: 'entry'; readonly entry: EntryRef }
  readonly search: string
}

export type NoteEntryChange =
  | { readonly type: 'replace'; readonly items: readonly EntryRef[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryRef[]
      readonly remove?: readonly EntryRef[]
    }

/** A note side orders EntryRefs; an entry side orders note IDs. */
export type NoteOrderScope =
  | { readonly type: 'note'; readonly noteId: string }
  | { readonly type: 'entry'; readonly entry: EntryRef }

export interface NoteEntriesApi {
  /**
   * Read the note's associated entry identities in its saved order, independently of entry-side
   * note order.
   */
  list(noteId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<EntryRef>>

  /**
   * Compare and change this note's complete ordered association side atomically; removing
   * associations does not delete entries.
   */
  applyChanges(
    noteId: string,
    input: { readonly change: NoteEntryChange; readonly expected?: readonly EntryRef[] },
    call?: CallOptions,
  ): Promise<void>

  /** Reorder selected slots on the actual note or entry side using its complete baseline. */
  reorder(scope: NoteOrderScope, input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Apply current-position move intent to the supplied side; the opposite side's order stays
   * unchanged.
   */
  move(scope: NoteOrderScope, input: MoveInput, call?: CallOptions): Promise<void>
}

/** A new note must have a title, nonblank body or adopted cover; editor opening and associations alone create nothing. */
export interface NotesApi {
  /**
   * Read note summaries in the requested association scope; independent unassociated notes
   * remain valid records.
   */
  list(query: NoteQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<NoteSummary>>

  /**
   * Read the saved article and its metadata without creating a draft or acquiring displayed
   * attachment resources.
   */
  get(id: string, call?: CallOptions): Promise<Note | null>

  /**
   * Commit a meaningful new note, its associations and adopted attachments together; opening an
   * editor alone creates nothing.
   */
  create(input: NoteCreate, call?: CallOptions): Promise<string>

  /**
   * Compare and commit the changed article fields and any complete association replacement; an
   * existing empty note remains valid.
   */
  update(id: string, input: NoteUpdate, call?: CallOptions): Promise<void>

  /**
   * Delete the selected notes and their references, preserving associated entries and
   * independently held attachment bytes.
   */
  delete(ids: string | NonEmptyArray<string>, call?: CallOptions): Promise<void>

  readonly entries: NoteEntriesApi
}

const noteFields = {
  title: v.pipe(
    v.nullable(text),
    v.transform((value) => value?.trim() || null),
  ),
  content: text,
  primaryImageId: v.nullable(id),
}

const entryKey = (ref: EntryRef): string => JSON.stringify([ref.type, ref.id])

const entries = v.pipe(
  v.array(entryRefSchema),
  v.check((refs) => unique(refs, entryKey)),
)

/** Validate a note creation without trimming the body or treating selected entries as saved content. */
export function parseNoteCreate(input: unknown): NoteCreate {
  const value = parseValue(
    v.strictObject({
      ...optionalFields(noteFields),
      entries: v.exactOptional(entries),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid note creation',
  )
  if (!value.title && !value.content?.trim() && !value.primaryImageId) {
    throw new DesktopError('InvalidInput', 'A new note needs a title, body or adopted cover')
  }

  return value
}

/** Existing notes may be cleared. Every compared value must belong to the actual submitted save unit. */
export function parseNoteUpdate(input: unknown): NoteUpdate {
  const fields = v.strictObject(optionalFields({ ...noteFields, entries }))
  const value = parseValue(
    v.strictObject({
      changes: fields,
      expected: v.exactOptional(fields),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid note edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Parse only library/unassociated/actual entry scopes; notes do not associate with Part identities. */
export function parseNoteQuery(input: unknown): NoteQuery {
  return parseValue(
    v.strictObject({
      scope: v.union([
        v.strictObject({ type: v.picklist(['library', 'unassociated']) }),
        v.strictObject({ type: v.literal('entry'), entry: entryRefSchema }),
      ]),
      search: text,
    }),
    input,
    'Invalid note query',
  )
}

/** Reject empty incremental requests, duplicate identities and contradictory changes on the note side. */
export function parseNoteEntryChange(input: unknown): NoteEntryChange {
  return parseValue(
    v.union([
      v.strictObject({ type: v.literal('replace'), items: entries }),
      v.pipe(
        v.strictObject({
          type: v.literal('modify'),
          add: v.exactOptional(entries),
          remove: v.exactOptional(entries),
        }),
        v.check(
          (value) =>
            (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
            !(value.add ?? []).some((ref) =>
              value.remove?.some((removed) => entryKey(ref) === entryKey(removed)),
            ),
        ),
      ),
    ]),
    input,
    'Invalid note entry associations',
  )
}
