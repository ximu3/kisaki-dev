import { membershipChangeSchema } from './membership'
import type { PreparedAttachment } from '../resources'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import { text, id, unique, parseValue, optionalFields, validateExpectedKeys } from '../validation'
import { entryRefSchema, preparedSchema, type EntryRef } from './catalog'
import { DesktopError } from '../errors'

export interface NoteFields {
  readonly title: string | null
  readonly content: string
  readonly primaryImageId: string | null
}

export interface Note extends NoteFields {
  readonly id: string
  readonly createdAt: number
  readonly updatedAt: number
}

export interface NoteSummary {
  readonly id: string
  readonly title: string | null
  readonly contentExcerpt: string | null
  readonly primaryImageId: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface NoteCreate {
  readonly title?: string | null
  readonly content?: string
  readonly primaryImageId?: string | null
  readonly entries?: readonly EntryRef[]
  readonly prepared?: readonly PreparedAttachment[]
}

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
  list(noteId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<EntryRef>>

  applyChanges(
    noteId: string,
    input: { readonly change: NoteEntryChange; readonly expected?: readonly EntryRef[] },
    call?: CallOptions,
  ): Promise<void>

  reorder(scope: NoteOrderScope, input: ReorderInput, call?: CallOptions): Promise<void>

  move(scope: NoteOrderScope, input: MoveInput, call?: CallOptions): Promise<void>
}

export interface NotesApi {
  list(query: NoteQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<NoteSummary>>

  get(id: string, call?: CallOptions): Promise<Note | null>

  create(input: NoteCreate, call?: CallOptions): Promise<string>

  update(id: string, input: NoteUpdate, call?: CallOptions): Promise<void>

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

export function parseNoteEntryChange(input: unknown): NoteEntryChange {
  return parseValue(
    membershipChangeSchema(entryRefSchema, entryRefSchema, (entry) => entry, entryKey),
    input,
    'Invalid note entry associations',
  )
}
