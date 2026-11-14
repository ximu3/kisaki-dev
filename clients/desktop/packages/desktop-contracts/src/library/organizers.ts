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

/**
 * Editable collection metadata, cover and sensitivity.
 *
 * Sensitivity does not propagate to members. Markdown is preserved except wholly blank values.
 */
export interface CollectionFields {
  readonly name: string
  readonly description: string | null
  readonly primaryImageId: string | null
  readonly isNsfw: boolean
}

/**
 * Editable shared tag metadata and sensitivity, separate from per-application attributes.
 *
 * Sensitivity does not propagate to tagged entries.
 */
export interface TagFields {
  readonly name: string
  readonly description: string | null
  readonly isNsfw: boolean
}

/**
 * A saved collection with stable identity, formal order and its actual membership mode.
 *
 * Invalid stored dynamic rules remain unavailable rather than broadening membership.
 */
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

/** A saved shared tag with stable identity, canonical name key and timestamps. */
export interface Tag extends TagFields {
  readonly id: string
  /** Locale-independent identity key produced by tagNameKey; display spelling remains in name. */
  readonly nameKey: string
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/** Lightweight collection display fields and membership mode, excluding the long description. */
export interface CollectionListItem {
  readonly id: string
  readonly name: string
  readonly primaryImageId: string | null
  readonly isNsfw: boolean
  readonly membershipMode: 'manual' | 'dynamic'
}

/** Lightweight shared tag fields for directory listings. */
export interface TagListItem {
  readonly id: string
  readonly name: string
  readonly isNsfw: boolean
}

/**
 * An explicit field sort or the organizer's natural scope order.
 *
 * Scope means global manual collection order or default tag-name order; tags have no global manual
 * order.
 */
export type OrganizerSort =
  | { readonly type: 'scope' }
  | {
      readonly type: 'field'
      readonly field: 'name' | 'createdAt' | 'updatedAt'
      readonly direction: 'asc' | 'desc'
    }

/** Collection-directory search, ordering and optional membership-mode filtering. */
export interface CollectionQuery {
  readonly search: string
  readonly sort: OrganizerSort
  readonly membershipMode?: 'manual' | 'dynamic'
}

/** Tag-directory search, ordering and optional used-or-unused filtering. */
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

/** A manual collection member with an optional association note. */
export interface CollectionMemberInput {
  readonly entry: EntryRef
  readonly note?: string | null
}

/** A tag application and its own note and spoiler flag. */
export interface TagEntry {
  readonly entry: EntryRef
  readonly note: string | null
  readonly isSpoiler: boolean
}

/** A tag application supplied with optional note and spoiler attributes. */
export interface TagEntryInput {
  readonly entry: EntryRef
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

/** Complete manual-collection membership replacement or disjoint incremental changes. */
export type CollectionMemberChange =
  | { readonly type: 'replace'; readonly items: readonly CollectionMemberInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly CollectionMemberInput[]
      readonly remove?: readonly EntryRef[]
    }

/** Complete tag-side application replacement or disjoint incremental changes. */
export type TagEntryChange =
  | { readonly type: 'replace'; readonly items: readonly TagEntryInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly TagEntryInput[]
      readonly remove?: readonly EntryRef[]
    }

/**
 * A new manual collection with optional initial members, or a dynamic collection with complete
 * rules.
 *
 * Dynamic collections do not store member rows.
 */
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

/**
 * Collection metadata or complete dynamic-rule changes with matching expected values.
 *
 * Membership-mode conversion is a separate operation.
 */
export interface CollectionUpdate {
  readonly changes: Partial<CollectionFields> & { readonly dynamicRules?: DynamicRules }
  readonly expected?: Partial<CollectionFields> & { readonly dynamicRules?: DynamicRules }
  readonly prepared?: readonly PreparedAttachment[]
}

/** A new shared tag definition with optional prepared attachments for descriptive content. */
export interface TagCreate {
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
  readonly prepared?: readonly PreparedAttachment[]
}

/** Shared tag-field changes and matching expected values, separate from application attributes. */
export interface TagUpdate {
  readonly changes: Partial<TagFields>
  readonly expected?: Partial<TagFields>
  readonly prepared?: readonly PreparedAttachment[]
}

/** Ordered source identities and a separate survivor for fixed organizer-merge rules. */
export interface OrganizerMerge {
  readonly sourceIds: NonEmptyArray<string>
  readonly targetId: string
}

/** The retained organizer identity and the source identities removed by the merge. */
export interface OrganizerMergeResult {
  readonly targetId: string
  readonly removedIds: readonly string[]
}

/**
 * Saved manual-collection membership and collection-side member order.
 *
 * These operations preserve entry records and do not convert dynamic collections.
 */
export interface CollectionMembersApi {
  /**
   * Lists a manual collection's saved members and notes.
   *
   * Dynamic membership is read through entry queries.
   */
  list(
    collectionId: string,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionMember>>

  /**
   * Applies explicit manual membership changes atomically.
   *
   * Complete replacement may compare a whole-side baseline. Hidden members are not implicitly
   * removed.
   */
  applyChanges(
    collectionId: string,
    input: {
      readonly change: CollectionMemberChange
      readonly expected?: readonly CollectionMember[]
    },
    call?: CallOptions,
  ): Promise<void>

  /** Compares and changes one membership note while preserving the entry and other memberships. */
  update(
    collectionId: string,
    entry: EntryRef,
    input: { readonly note: string | null; readonly expected?: { readonly note: string | null } },
    call?: CallOptions,
  ): Promise<void>

  /** Reorders selected member slots against the manual collection's complete order baseline. */
  reorder(collectionId: string, input: ReorderInput<EntryRef>, call?: CallOptions): Promise<void>

  /** Moves supplied manual members within the collection's current order. */
  move(collectionId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}

/** Tag applications with association-specific attributes and independent order on each side. */
export interface TagEntriesApi {
  /** Lists visible applications and their saved attributes in tag-side order. */
  list(tagId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<TagEntry>>

  /**
   * Applies explicit tag-side membership changes, comparing whole-side baselines for replacement.
   *
   * Removing the last application preserves the shared tag.
   */
  applyChanges(
    tagId: string,
    input: { readonly change: TagEntryChange; readonly expected?: readonly TagEntry[] },
    call?: CallOptions,
  ): Promise<void>

  /** Compares and changes an application's note or spoiler flag while preserving the shared tag. */
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
   * Reorders selected application slots against the complete tag-side baseline.
   *
   * Entry-side tag order remains unchanged.
   */
  reorder(tagId: string, input: ReorderInput<EntryRef>, call?: CallOptions): Promise<void>

  /** Moves applications in the tag's current order while preserving order on their entry sides. */
  move(tagId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}

/**
 * Collection definitions, global order, manual membership and explicit mode conversion.
 *
 * Merging requires manual participants. Conversion evaluates complete dynamic membership
 * atomically.
 */
export interface CollectionsApi {
  /** Lists visible collection summaries without materializing dynamic membership. */
  list(
    query: CollectionQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionListItem>>

  /**
   * Reads saved collection configuration, or null when absent.
   *
   * Invalid stored dynamic rules remain explicit.
   */
  get(id: string, call?: CallOptions): Promise<Collection | null>

  /**
   * Commits a manual collection with initial members or a dynamic collection with complete rules.
   */
  create(input: CollectionCreate, call?: CallOptions): Promise<string>

  /**
   * Compares and commits collection metadata or complete dynamic rules, preserving membership mode.
   */
  update(id: string, input: CollectionUpdate, call?: CallOptions): Promise<void>

  /**
   * Deletes the collection and its references while preserving member entries and personal records.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Merges manual collections into the chosen survivor using fixed current-fact rules.
   *
   * An invalid participant rejects the whole operation.
   */
  merge(input: OrganizerMerge, call?: CallOptions): Promise<OrganizerMergeResult>

  /**
   * Compares saved rules and materializes their complete unfiltered result in one commit.
   *
   * The collection retains its identity.
   */
  convertToManual(
    id: string,
    input: { readonly expected: { readonly dynamicRules: DynamicRules } },
    call?: CallOptions,
  ): Promise<void>

  /** Reorders selected collection slots against the complete library collection-order baseline. */
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Moves selected collections in the current library order followed by entry-side collection
   * lists.
   */
  move(input: MoveInput, call?: CallOptions): Promise<void>

  readonly members: CollectionMembersApi
}

/**
 * Shared tag definitions and explicit merges.
 *
 * Tags remain after their last application is removed. Name conflicts do not imply automatic
 * merging.
 */
export interface TagsApi {
  /**
   * Lists visible tags, including unused tags, under the requested name and application filters.
   */
  list(query: TagQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<TagListItem>>

  /** Reads a saved shared tag definition, or null when absent, without changing applications. */
  get(id: string, call?: CallOptions): Promise<Tag | null>

  /**
   * Finds a tag by its canonical name key.
   *
   * Committing operations recheck uniqueness against current records.
   */
  findByName(name: string, call?: CallOptions): Promise<Tag | null>

  /**
   * Creates an independent tag after a complete canonical-name uniqueness check.
   *
   * A conflict leaves the existing tag unchanged.
   */
  create(input: TagCreate, call?: CallOptions): Promise<string>

  /** Compares and commits shared tag changes while preserving application attributes and orders. */
  update(id: string, input: TagUpdate, call?: CallOptions): Promise<void>

  /**
   * Deletes a tag and its applications while preserving entries and personal records.
   *
   * Referencing rules retain the now-unavailable identity.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Merges definitions, applications and formal references into the explicit target atomically. */
  merge(input: OrganizerMerge, call?: CallOptions): Promise<OrganizerMergeResult>

  readonly entries: TagEntriesApi
}

/** Nonblank organizer name normalized by trimming only its outer whitespace. */
const name = v.pipe(
  nonemptyText,
  v.transform((value) => value.trim()),
)

/** Optional organizer description with blank values represented as null. */
const description = v.pipe(
  v.nullable(text),
  v.transform((value) => (value === null || value.trim().length === 0 ? null : value)),
)

/** Tag metadata fields shared by creation, edits and comparison baselines. */
export const tagEntries = { name, description, isNsfw: v.boolean() }

/** Collection metadata fields, including its optional primary image. */
const collectionEntries = { ...tagEntries, primaryImageId: v.nullable(id) }

/** Complete saved dynamic membership definition with its own validation contract. */
const dynamicRules = v.pipe(v.unknown(), v.transform(parseDynamicRules))

/** Explicit or scope-owned ordering available to organizer lists. */
const sort = v.union([
  v.strictObject({ type: v.literal('scope') }),
  v.strictObject({
    type: v.literal('field'),
    field: v.picklist(['name', 'createdAt', 'updatedAt']),
    direction: v.picklist(['asc', 'desc']),
  }),
])

/** Typed collection member input with an optional membership note. */
const memberSchema = v.strictObject({
  entry: entryRefSchema,
  note: v.exactOptional(v.nullable(text)),
})

/** Typed tag-application input with optional note and spoiler state. */
const tagEntrySchema = v.strictObject({
  ...memberSchema.entries,
  isSpoiler: v.exactOptional(v.boolean()),
})

/** Encodes entry kind and identity for membership comparison. */
const entryKey = (entry: EntryRef): string => JSON.stringify([entry.type, entry.id])

/**
 * Computes a tag identity key using NFKC, trimmed and collapsed whitespace, and lowercase.
 *
 * Display spelling is preserved separately.
 */
export function tagNameKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

/** Parses collection search, order and membership-mode filtering. */
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

/** Parses tag search, order and optional application-usage filtering. */
export function parseTagQuery(input: unknown): TagQuery {
  return parseValue(
    v.strictObject({ search: text, sort, used: v.exactOptional(v.boolean()) }),
    input,
    'Invalid tag query',
  )
}

/** Parses complete creation intent, allowing initial members only for manual collections. */
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

/**
 * Parses collection field changes and matching expected values without converting membership mode.
 */
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

/** Parses a shared tag definition and normalizes its display name without a uniqueness lookup. */
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

/** Parses shared tag changes and expected values for the same fields. */
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

/** Parses distinct ordered source IDs and rejects a survivor included among them. */
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

/** Builds unique membership replacement and disjoint nonempty incremental-change schemas. */
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

/**
 * Parses complete or disjoint incremental collection membership intent.
 *
 * The write owner checks current membership mode and actual endpoints.
 */
export function parseCollectionMemberChange(input: unknown): CollectionMemberChange {
  return parseValue(memberChangeSchema(memberSchema), input, 'Invalid collection membership')
}

/** Parses complete or disjoint incremental tag-application intent. */
export function parseTagEntryChange(input: unknown): TagEntryChange {
  return parseValue(memberChangeSchema(tagEntrySchema), input, 'Invalid tag applications')
}

/** Requires explicit complete replacement when a whole-set membership baseline is supplied. */
export function validateMembershipExpected(
  change: CollectionMemberChange | TagEntryChange,
  expected: readonly unknown[] | undefined,
): void {
  if (expected !== undefined && change.type !== 'replace') {
    throw new DesktopError('InvalidInput', 'A membership baseline requires complete replacement')
  }
}
