/** @fileoverview Defines collections and tags as independent organizers with explicit member-side edits. */

import type {
  StoredDefinition,
  NonEmptyArray,
  ListOptions,
  CallOptions,
  ListResult,
} from '../operations'
import type { DynamicRules } from './query/definition'
import type { EntryRef } from './catalog'
import type { PreparedAttachment } from '../resources'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import {
  nonemptyText,
  text,
  id,
  parseValue,
  optionalFields,
  unique,
  validateExpectedKeys,
} from '../validation'
import { parseDynamicRules } from './query/definition'
import { entryRefSchema, preparedSchema } from './catalog'
import { DesktopError } from '../errors'

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
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
} & (
    | { readonly membershipMode: 'manual'; readonly dynamicRules: null }
    | { readonly membershipMode: 'dynamic'; readonly dynamicRules: StoredDefinition<DynamicRules> }
  )

export interface Tag extends TagFields {
  readonly id: string
  readonly nameKey: string
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
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
  /**
   * Read a manual collection's saved member associations and notes; dynamic results use the
   * entry query surface.
   */
  list(
    collectionId: string,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionMember>>

  /**
   * Compare and change the manual collection's complete ordered side atomically; hidden members
   * are not an implicit removal request.
   */
  applyChanges(
    collectionId: string,
    input: {
      readonly change: CollectionMemberChange
      readonly expected?: readonly CollectionMember[]
    },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Compare and change this member's note without editing the entry or its other collection
   * memberships.
   */
  update(
    collectionId: string,
    entry: EntryRef,
    input: { readonly note: string | null; readonly expected?: { readonly note: string | null } },
    call?: CallOptions,
  ): Promise<void>

  /** Reorder selected member slots against the manual collection's complete order baseline. */
  reorder(collectionId: string, input: ReorderInput<EntryRef>, call?: CallOptions): Promise<void>

  /**
   * Move the supplied manual members within current order; this operation never converts a
   * dynamic collection.
   */
  move(collectionId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}

/** Tag-entry applications have separate note/spoiler attributes and their own order on each real side. */
export interface TagEntriesApi {
  /**
   * Read the tag's visible applications and their saved application attributes in tag-side
   * order.
   */
  list(tagId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<TagEntry>>

  /**
   * Compare and change this tag's complete ordered application side; removing its last
   * application leaves the tag intact.
   */
  applyChanges(
    tagId: string,
    input: { readonly change: TagEntryChange; readonly expected?: readonly TagEntry[] },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Compare and change only this application's note or spoiler flag; the tag's shared definition
   * remains unchanged.
   */
  update(
    tagId: string,
    entry: EntryRef,
    input: {
      readonly changes: Partial<Pick<TagEntry, 'note' | 'isSpoiler'>>
      readonly expected?: Partial<Pick<TagEntry, 'note' | 'isSpoiler'>>
    },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Reorder selected application slots against the complete tag-side baseline, preserving
   * entry-side tag order.
   */
  reorder(tagId: string, input: ReorderInput<EntryRef>, call?: CallOptions): Promise<void>

  /**
   * Move the supplied applications in the tag's current order without changing order on their
   * entry sides.
   */
  move(tagId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}

/** Collection merge requires manual participants; conversion first evaluates complete data in one atomic operation. */
export interface CollectionsApi {
  /**
   * Read visible collection summaries and their current projections without materializing
   * dynamic membership.
   */
  list(
    query: CollectionQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionListItem>>

  /**
   * Read saved collection configuration; an invalid stored dynamic rule remains explicit instead
   * of broadening membership.
   */
  get(id: string, call?: CallOptions): Promise<Collection | null>

  /**
   * Commit a manual collection with explicit members or a dynamic collection with complete
   * rules; no background membership copy is created.
   */
  create(input: CollectionCreate, call?: CallOptions): Promise<string>

  /**
   * Compare and commit changed collection facts or the complete dynamic rule value; membership
   * mode is not an ordinary field edit.
   */
  update(id: string, input: CollectionUpdate, call?: CallOptions): Promise<void>

  /**
   * Delete this collection and its owned references while retaining member entries and their
   * personal records.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Merge only manual collections into the chosen target under fixed current-fact rules; any
   * invalid participant rolls back the whole operation.
   */
  merge(input: OrganizerMerge, call?: CallOptions): Promise<OrganizerMergeResult>

  /**
   * Compare the saved rules and materialize their complete unfiltered result in one commit,
   * retaining this collection's identity.
   */
  convertToManual(
    id: string,
    input: { readonly expected: { readonly dynamicRules: DynamicRules } },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Reorder selected collection slots against the complete library collection order, independent
   * of membership changes.
   */
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Move the selected collections in current library order; entry-side collection lists follow
   * that same order.
   */
  move(input: MoveInput, call?: CallOptions): Promise<void>

  readonly members: CollectionMembersApi
}

/** Tags remain after their final application is removed. Creation/name conflicts never imply an automatic merge. */
export interface TagsApi {
  /**
   * Read visible tag summaries, including unused tags, under the requested name and application
   * filters.
   */
  list(query: TagQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<TagListItem>>

  /** Read the saved shared tag definition without changing any application. */
  get(id: string, call?: CallOptions): Promise<Tag | null>

  /**
   * Look up a tag using the canonical name rule; committing operations still recheck name
   * uniqueness against actual records.
   */
  findByName(name: string, call?: CallOptions): Promise<Tag | null>

  /**
   * Create an independent tag after a full canonical-name uniqueness check; a conflict never
   * silently merges or edits an existing tag.
   */
  create(input: TagCreate, call?: CallOptions): Promise<string>

  /**
   * Compare and commit changed shared tag facts; application notes, spoiler flags and orders
   * remain separate.
   */
  update(id: string, input: TagUpdate, call?: CallOptions): Promise<void>

  /**
   * Delete the tag and its applications without deleting entries or personal records;
   * referencing rules retain an unavailable identity.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Merge definitions, applications and formal references into the explicit target atomically
   * using the fixed merge rules.
   */
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

/** Validate tag-directory search, sort and optional usage filtering without changing tag applications. */
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
