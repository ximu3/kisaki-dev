/** @fileoverview Defines collections and tags as independent organizers with explicit member-side edits. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import type {
  ListOptions,
  ListResult,
  NonEmptyArray,
  CallOptions,
  StoredDefinition,
} from '../operations'
import type { PreparedAttachment } from '../resources'
import { createTagNameKey } from '../text'
import {
  id,
  nonemptyText,
  optionalFields,
  parseValue,
  text,
  unique,
  validateExpectedKeys,
} from '../validation'
import { entryRefSchema, preparedSchema } from './catalog'
import type { EntryRef } from './catalog'
import type { MoveInput, ReorderInput } from './ordering'
import { parseDynamicRules } from './query'
import type { DynamicRules } from './query-values'

/** Organizer fields do not propagate sensitivity to their members. Markdown is preserved except wholly blank values. */
export interface CollectionFields {
  readonly name: string
  readonly description: string | null
  readonly primaryImageId: string | null
  readonly isNsfw: boolean
}
export interface TagFields {
  readonly name: string
  readonly description: string | null
  readonly isNsfw: boolean
}
/** Saved collections keep their actual membership mode, including an invalid dynamic definition that cannot execute. */
export type Collection = CollectionFields & {
  readonly id: string
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
} & (
    | { readonly membershipMode: 'manual'; readonly dynamicRules: null }
    | { readonly membershipMode: 'dynamic'; readonly dynamicRules: StoredDefinition<DynamicRules> }
  )
export interface Tag extends TagFields {
  readonly id: string
  readonly nameKey: string
  readonly createdAt: number
  readonly updatedAt: number
}
/** List projections omit long descriptions; organizer kind never joins EntryType. */
export interface CollectionListItem {
  readonly id: string
  readonly name: string
  readonly primaryImageId: string | null
  readonly isNsfw: boolean
  readonly membershipMode: 'manual' | 'dynamic'
}
export interface TagListItem {
  readonly id: string
  readonly name: string
  readonly isNsfw: boolean
}

/** Scope order is global manual collection order, and default name order for tags; no tag global reorder exists. */
export type OrganizerSort =
  | { readonly type: 'scope' }
  | {
      readonly type: 'field'
      readonly field: 'name' | 'createdAt' | 'updatedAt'
      readonly direction: 'asc' | 'desc'
    }
export interface CollectionQuery {
  readonly search: string
  readonly sort: OrganizerSort
  readonly membershipMode?: 'manual' | 'dynamic'
}
export interface TagQuery {
  readonly search: string
  readonly sort: OrganizerSort
  readonly used?: boolean
}

/** Explicit collection membership note is shared by both endpoints, with ordering only on the collection side. */
export interface CollectionMember {
  readonly entry: EntryRef
  readonly note: string | null
}
export interface CollectionMemberInput {
  readonly entry: EntryRef
  readonly note?: string | null
}
export interface TagEntry {
  readonly entry: EntryRef
  readonly note: string | null
  readonly isSpoiler: boolean
}
export interface TagEntryInput {
  readonly entry: EntryRef
  readonly note?: string | null
  readonly isSpoiler?: boolean
}
export type CollectionMemberChange =
  | { readonly type: 'replace'; readonly items: readonly CollectionMemberInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly CollectionMemberInput[]
      readonly remove?: readonly EntryRef[]
    }
export type TagEntryChange =
  | { readonly type: 'replace'; readonly items: readonly TagEntryInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly TagEntryInput[]
      readonly remove?: readonly EntryRef[]
    }

/** A dynamic collection has no stored members. Manual creation can establish its initial members atomically. */
export type CollectionCreate = {
  readonly name: string
  readonly description?: string | null
  readonly primaryImageId?: string | null
  readonly isNsfw?: boolean
  readonly prepared?: readonly PreparedAttachment[]
} & (
  | { readonly membershipMode?: 'manual'; readonly members?: readonly CollectionMemberInput[] }
  | { readonly membershipMode: 'dynamic'; readonly dynamicRules: DynamicRules }
)
export interface CollectionUpdate {
  readonly changes: Partial<CollectionFields> & { readonly dynamicRules?: DynamicRules }
  readonly expected?: Partial<CollectionFields> & { readonly dynamicRules?: DynamicRules }
  readonly prepared?: readonly PreparedAttachment[]
}
export interface TagCreate {
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
  readonly prepared?: readonly PreparedAttachment[]
}
export interface TagUpdate {
  readonly changes: Partial<TagFields>
  readonly expected?: Partial<TagFields>
  readonly prepared?: readonly PreparedAttachment[]
}
/** Source order is significant for fixed merge rules; the target must not occur among the distinct source IDs. */
export interface OrganizerMerge {
  readonly sourceIds: NonEmptyArray<string>
  readonly targetId: string
}
export interface OrganizerMergeResult {
  readonly targetId: string
  readonly removedIds: readonly string[]
}

/** Manual member operations never convert dynamic collections or modify the actual entries. */
export interface CollectionMembersApi {
  list(
    collectionId: string,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionMember>>
  applyChanges(
    collectionId: string,
    input: {
      readonly change: CollectionMemberChange
      readonly expected?: readonly CollectionMember[]
    },
    call?: CallOptions,
  ): Promise<void>
  update(
    collectionId: string,
    entry: EntryRef,
    input: { readonly note: string | null; readonly expected?: { readonly note: string | null } },
    call?: CallOptions,
  ): Promise<void>
  reorder(collectionId: string, input: ReorderInput<EntryRef>, call?: CallOptions): Promise<void>
  move(collectionId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}
/** Tag-entry applications have separate note/spoiler attributes and their own order on each real side. */
export interface TagEntriesApi {
  list(tagId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<TagEntry>>
  applyChanges(
    tagId: string,
    input: { readonly change: TagEntryChange; readonly expected?: readonly TagEntry[] },
    call?: CallOptions,
  ): Promise<void>
  update(
    tagId: string,
    entry: EntryRef,
    input: {
      readonly changes: Partial<Pick<TagEntry, 'note' | 'isSpoiler'>>
      readonly expected?: Partial<Pick<TagEntry, 'note' | 'isSpoiler'>>
    },
    call?: CallOptions,
  ): Promise<void>
  reorder(tagId: string, input: ReorderInput<EntryRef>, call?: CallOptions): Promise<void>
  move(tagId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}
/** Collection merge requires manual participants; conversion first evaluates complete data in one atomic operation. */
export interface CollectionsApi {
  list(
    query: CollectionQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionListItem>>
  get(id: string, call?: CallOptions): Promise<Collection | null>
  create(input: CollectionCreate, call?: CallOptions): Promise<string>
  update(id: string, input: CollectionUpdate, call?: CallOptions): Promise<void>
  delete(id: string, call?: CallOptions): Promise<void>
  merge(input: OrganizerMerge, call?: CallOptions): Promise<OrganizerMergeResult>
  convertToManual(
    id: string,
    input: { readonly expected: { readonly dynamicRules: DynamicRules } },
    call?: CallOptions,
  ): Promise<void>
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>
  move(input: MoveInput, call?: CallOptions): Promise<void>
  readonly members: CollectionMembersApi
}
/** Tags remain after their final application is removed. Creation/name conflicts never imply an automatic merge. */
export interface TagsApi {
  list(query: TagQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<TagListItem>>
  get(id: string, call?: CallOptions): Promise<Tag | null>
  findByName(name: string, call?: CallOptions): Promise<Tag | null>
  create(input: TagCreate, call?: CallOptions): Promise<string>
  update(id: string, input: TagUpdate, call?: CallOptions): Promise<void>
  delete(id: string, call?: CallOptions): Promise<void>
  merge(input: OrganizerMerge, call?: CallOptions): Promise<OrganizerMergeResult>
  readonly entries: TagEntriesApi
}

const name = v.pipe(
  nonemptyText,
  v.transform((value) => value.trim()),
)
const description = v.pipe(
  v.nullable(text),
  v.transform((value) => (value === null || value.trim().length === 0 ? null : value)),
)
export const tagEntries = { name, description, isNsfw: v.boolean() }
const collectionEntries = { ...tagEntries, primaryImageId: v.nullable(id) }
const dynamicRules = v.pipe(v.unknown(), v.transform(parseDynamicRules))
const sort = v.union([
  v.strictObject({ type: v.literal('scope') }),
  v.strictObject({
    type: v.literal('field'),
    field: v.picklist(['name', 'createdAt', 'updatedAt']),
    direction: v.picklist(['asc', 'desc']),
  }),
])
const memberSchema = v.strictObject({
  entry: entryRefSchema,
  note: v.exactOptional(v.nullable(text)),
})
const tagEntrySchema = v.strictObject({
  ...memberSchema.entries,
  isSpoiler: v.exactOptional(v.boolean()),
})
const entryKey = (entry: EntryRef): string => JSON.stringify([entry.type, entry.id])

/** Parse an organizer query without a visibility override or any entry-only fields. */
export function parseCollectionQuery(input: unknown): CollectionQuery {
  return parseValue(
    v.strictObject({
      search: text,
      sort,
      membershipMode: v.exactOptional(v.picklist(['manual', 'dynamic'])),
    }),
    input,
    'Invalid collection query',
  )
}
export function parseTagQuery(input: unknown): TagQuery {
  return parseValue(
    v.strictObject({ search: text, sort, used: v.exactOptional(v.boolean()) }),
    input,
    'Invalid tag query',
  )
}

/** Validate whole creation intent; only a manual collection may carry initial member rows. */
export function parseCollectionCreate(input: unknown): CollectionCreate {
  const common = {
    ...optionalFields(collectionEntries),
    name,
    prepared: v.exactOptional(v.array(preparedSchema)),
  }
  return parseValue(
    v.union([
      v.strictObject({
        ...common,
        membershipMode: v.exactOptional(v.literal('manual')),
        members: v.exactOptional(
          v.pipe(
            v.array(memberSchema),
            v.check((items) => unique(items, (item) => entryKey(item.entry))),
          ),
        ),
      }),
      v.strictObject({ ...common, membershipMode: v.literal('dynamic'), dynamicRules }),
    ]),
    input,
    'Invalid collection creation',
  )
}
/** Validate an ordinary save; mode conversion is a separate operation and related baselines remain field-local. */
export function parseCollectionUpdate(input: unknown): CollectionUpdate {
  const fields = v.strictObject(optionalFields({ ...collectionEntries, dynamicRules }))
  const value = parseValue(
    v.strictObject({
      changes: fields,
      expected: v.exactOptional(fields),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid collection edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}
/** Validate a real tag definition and its normalizable name without performing uniqueness lookup. */
export function parseTagCreate(input: unknown): TagCreate {
  const value = parseValue(
    v.strictObject({
      ...optionalFields(tagEntries),
      name,
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid tag creation',
  )
  createTagNameKey(value.name)
  return value
}
/** Tag definitions have no cover, namespace or global manual order. */
export function parseTagUpdate(input: unknown): TagUpdate {
  const fields = v.strictObject(optionalFields(tagEntries))
  const value = parseValue(
    v.strictObject({
      changes: fields,
      expected: v.exactOptional(fields),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid tag edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}
/** Reject duplicate sources or selecting the target as a source, preserving the caller's merge order. */
export function parseOrganizerMerge(input: unknown): OrganizerMerge {
  return parseValue(
    v.pipe(
      v.strictObject({
        sourceIds: v.pipe(
          v.tupleWithRest([id], id),
          v.check((ids) => unique(ids, (value) => value)),
        ),
        targetId: id,
      }),
      v.check((value) => !value.sourceIds.includes(value.targetId)),
    ),
    input,
    'Invalid organizer merge',
  )
}

function memberChangeSchema<T extends v.GenericSchema<unknown, { entry: EntryRef }>>(member: T) {
  const members = v.pipe(
    v.array(member),
    v.check((items) => unique(items, (item) => entryKey(item.entry))),
  )
  return v.union([
    v.strictObject({ type: v.literal('replace'), items: members }),
    v.pipe(
      v.strictObject({
        type: v.literal('modify'),
        add: v.exactOptional(members),
        remove: v.exactOptional(
          v.pipe(
            v.array(entryRefSchema),
            v.check((refs) => unique(refs, entryKey)),
          ),
        ),
      }),
      v.check(
        (value) =>
          (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
          !(value.add ?? []).some((item) =>
            value.remove?.some((ref) => entryKey(ref) === entryKey(item.entry)),
          ),
      ),
    ),
  ])
}
/** Parse complete or disjoint incremental collection membership; current mode and endpoints are commit-time facts. */
export function parseCollectionMemberChange(input: unknown): CollectionMemberChange {
  return parseValue(memberChangeSchema(memberSchema), input, 'Invalid collection membership')
}
/** Parse a tag's actual applications without converting repeated adds into attribute overwrites. */
export function parseTagEntryChange(input: unknown): TagEntryChange {
  return parseValue(memberChangeSchema(tagEntrySchema), input, 'Invalid tag applications')
}
/** Whole-set baselines are legal only for an explicit complete replacement, never for incremental additions. */
export function validateMembershipExpected(
  change: CollectionMemberChange | TagEntryChange,
  expected: readonly unknown[] | undefined,
): void {
  if (expected !== undefined && change.type !== 'replace') {
    throw new DesktopError('InvalidInput', 'A membership baseline requires complete replacement')
  }
}
