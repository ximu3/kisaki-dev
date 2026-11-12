/** @fileoverview Defines independently saved notes and their explicit, separately ordered entry associations. */

import type { EntryRef } from './catalog'
import type { PreparedAttachment } from '../resources'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import { text, id, unique, parseValue, optionalFields, validateExpectedKeys } from '../validation'
import { entryRefSchema, preparedSchema } from './catalog'
import { DesktopError } from '../errors'

/**
 * The independently saved article, title and cover of a note.
 *
 * Body whitespace and empty existing notes are preserved.
 */
export interface NoteFields {
  readonly title: string | null
  readonly content: string
  readonly primaryImageId: string | null
}

/** A saved note with stable identity and creation and update times. */
export interface Note extends NoteFields {
  readonly id: string
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/** Lightweight note display metadata and a body excerpt for listings. */
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

/**
 * New note content, initial entry associations and prepared attachment holds.
 *
 * Creation requires a title, nonblank body or adopted cover.
 */
export interface NoteCreate {
  readonly title?: string | null
  readonly content?: string
  readonly primaryImageId?: string | null
  readonly entries?: readonly EntryRef[]
  readonly prepared?: readonly PreparedAttachment[]
}

/**
 * Article-field changes and optional complete entry-association replacement.
 *
 * Expected entries compare this note's ordered side; unchanged associations are not compared.
 */
export interface NoteUpdate {
  readonly changes: Partial<NoteFields> & { readonly entries?: readonly EntryRef[] }
  readonly expected?: Partial<NoteFields> & { readonly entries?: readonly EntryRef[] }
  readonly prepared?: readonly PreparedAttachment[]
}

/** Search within the visible library, unassociated notes or one entry's associated notes. */
export interface NoteQuery {
  readonly scope:
    | { readonly type: 'library' | 'unassociated' }
    | { readonly type: 'entry'; readonly entry: EntryRef }
  readonly search: string
}

/** Complete note-side entry replacement or disjoint incremental association changes. */
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

/** Note-entry membership and independently owned order on each association side. */
export interface NoteEntriesApi {
  /** Lists associated entries in the note's saved order, independently of entry-side note order. */
  list(noteId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<EntryRef>>

  /**
   * Compares and changes the note's ordered association side atomically.
   *
   * Removing an association preserves its entry.
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
 * Independent saved notes and their explicit entry associations.
 *
 * New notes require meaningful content; editor opening and association choices alone create no
 * record.
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
   * Compares and commits article changes and any complete association replacement.
   *
   * An existing note may be cleared and remain valid.
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

/** Encodes an entry's kind and identity for association comparison. */
const entryKey = (ref: EntryRef): string => JSON.stringify([ref.type, ref.id])

const entries = v.pipe(
  v.array(entryRefSchema),
  v.check((refs) => unique(refs, entryKey)),
)

/**
 * Parses meaningful new-note input without trimming body content.
 *
 * Association choices alone do not satisfy the content requirement.
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

/**
 * Parses note changes and expected values for the submitted save units, allowing content clearing.
 */
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
 * Parses complete or incremental note-side membership intent.
 *
 * Rejects empty incremental requests, duplicate identities and overlapping additions and removals.
 */
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
