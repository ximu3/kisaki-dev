import { membershipChangeSchema } from './membership'
import type { PreparedAttachment } from '../resources'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import { text, id, unique, parseValue, optionalFields, validateExpectedKeys } from '../validation'
import { entryRefSchema, preparedSchema, type EntryRef } from './catalog'
import { DesktopError } from '../errors'

/** Body whitespace and empty saved notes are preserved. */
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

/** Creation requires a title, nonblank body or adopted cover. */
export interface NoteCreate {
  readonly title?: string | null
  readonly content?: string
  readonly primaryImageId?: string | null
  readonly entries?: readonly EntryRef[]
  readonly prepared?: readonly PreparedAttachment[]
}

/**
 * An entry baseline compares this note's whole ordered side for a replacement. Unchanged
 * associations are outside the comparison.
 */
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

export type NoteOrderScope =
  | { readonly type: 'note'; readonly noteId: string }
  | { readonly type: 'entry'; readonly entry: EntryRef }

export interface NoteEntriesApi {
  /** Lists associated entries in the note's saved order, independently of entry-side note order. */
  list(noteId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<EntryRef>>

  /**
   * Changes the note's ordered side in one transaction. Removed associations leave their entries
   * intact.
   */
  applyChanges(
    noteId: string,
    input: { readonly change: NoteEntryChange; readonly expected?: readonly EntryRef[] },
    call?: CallOptions,
  ): Promise<void>

  /** Reorders selected slots on the specified note or entry side against its complete baseline. */
  reorder(scope: NoteOrderScope, input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Applies current-position move intent to one side while preserving the opposite side's order.
   */
  move(scope: NoteOrderScope, input: MoveInput, call?: CallOptions): Promise<void>
}

/**
 * Creation requires meaningful note content. Opening an editor and choosing associations alone
 * create no record.
 */
export interface NotesApi {
  /**
   * Lists note summaries in the requested association scope, including independent unassociated
   * notes.
   */
  list(query: NoteQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<NoteSummary>>

  /**
   * Reads a saved article and metadata, or null when absent, without acquiring attachment
   * resources.
   */
  get(id: string, call?: CallOptions): Promise<Note | null>

  /** Commits a meaningful new note, its associations and adopted attachments together. */
  create(input: NoteCreate, call?: CallOptions): Promise<string>

  /**
   * An existing note can be cleared and remain valid. Submitted article fields and association
   * changes commit together.
   */
  update(id: string, input: NoteUpdate, call?: CallOptions): Promise<void>

  /**
   * Deletes selected notes and their references while preserving entries and independently held
   * bytes.
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

/**
 * Preserves body whitespace. An article needs meaningful content even when associations are
 * supplied.
 */
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

/** Parses library, unassociated-note or actual-entry query scopes. */
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

/**
 * Rejects empty incremental requests, duplicate identities and overlapping additions and removals.
 */
export function parseNoteEntryChange(input: unknown): NoteEntryChange {
  return parseValue(
    membershipChangeSchema(entryRefSchema, entryRefSchema, (entry) => entry, entryKey),
    input,
    'Invalid note entry associations',
  )
}
