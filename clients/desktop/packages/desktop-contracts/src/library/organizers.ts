import { membershipChangeSchema } from './membership'
import type {
  StoredDefinition,
  NonEmptyArray,
  ListOptions,
  CallOptions,
  ListResult,
} from '../operations'
import type { PreparedAttachment } from '../resources'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import {
  fromParser,
  nonemptyText,
  text,
  id,
  parseValue,
  optionalFields,
  unique,
  validateExpectedKeys,
} from '../validation'
import { parseDynamicRules, type DynamicRules } from './query/definition'
import { entryRefSchema, preparedSchema, type EntryRef } from './catalog'
import { DesktopError } from '../errors'

/**
 * Sensitivity is scoped to the collection. Wholly blank Markdown is cleared while the rest is
 * preserved.
 */
export interface CollectionFields {
  readonly name: string
  readonly description: string | null
  readonly primaryImageId: string | null
  readonly isNsfw: boolean
}

/** Sensitivity is scoped to the shared tag. Each application has its own attributes. */
export interface TagFields {
  readonly name: string
  readonly description: string | null
  readonly isNsfw: boolean
}

/** An invalid stored rule leaves membership unavailable. */
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
  /** Locale-independent identity key produced by tagNameKey; display spelling remains in name. */
  readonly nameKey: string
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

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

/** Scope order is global manual order for collections and default name order for tags. */
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

/** Only manual collections own saved member rows. */
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
 * The dynamic rules form one replacement value. Use the explicit conversion operation to change
 * membership mode.
 */
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

export interface OrganizerMerge {
  readonly sourceIds: NonEmptyArray<string>
  readonly targetId: string
}

export interface OrganizerMergeResult {
  readonly targetId: string
  readonly removedIds: readonly string[]
}

/**
 * Membership edits preserve the entries. Dynamic collections use the conversion operation before
 * manual editing.
 */
export interface CollectionMembersApi {
  /** For dynamic membership use the entry query API. */
  list(
    collectionId: string,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionMember>>

  /**
   * Replacement can compare the complete side. Hidden memberships stay unless the submitted change
   * removes them.
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

  move(collectionId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}

export interface TagEntriesApi {
  /** Lists visible applications and their saved attributes in tag-side order. */
  list(tagId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<TagEntry>>

  /**
   * Replacement can compare the complete tag side. The shared tag survives removal of its last
   * application.
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

  /** The baseline covers the complete tag side. Entry-side tag order stays unchanged. */
  reorder(tagId: string, input: ReorderInput<EntryRef>, call?: CallOptions): Promise<void>

  /** Moves applications in the tag's current order while preserving order on their entry sides. */
  move(tagId: string, input: MoveInput<EntryRef>, call?: CallOptions): Promise<void>
}

/**
 * Merges require manual participants. Conversion materializes a complete dynamic result atomically.
 */
export interface CollectionsApi {
  /** Lists visible collection summaries without materializing dynamic membership. */
  list(
    query: CollectionQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<CollectionListItem>>

  /** Invalid stored dynamic rules remain explicit. Null means the collection is absent. */
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

  /** Includes only manual participants. An invalid participant rejects the complete merge. */
  merge(input: OrganizerMerge, call?: CallOptions): Promise<OrganizerMergeResult>

  /**
   * Compares saved rules and materializes the complete unfiltered result atomically under the same
   * collection identity.
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
 * A tag survives removal of its last application. A name conflict requires a separate merge
 * decision.
 */
export interface TagsApi {
  /**
   * Lists visible tags, including unused tags, under the requested name and application filters.
   */
  list(query: TagQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<TagListItem>>

  /** Reads a saved shared tag definition, or null when absent, without changing applications. */
  get(id: string, call?: CallOptions): Promise<Tag | null>

  /** Searches by the canonical name key. Committing operations recheck uniqueness. */
  findByName(name: string, call?: CallOptions): Promise<Tag | null>

  /**
   * Checks complete canonical-name uniqueness before creation. A conflicting tag remains intact.
   */
  create(input: TagCreate, call?: CallOptions): Promise<string>

  /** Compares and commits shared tag changes while preserving application attributes and orders. */
  update(id: string, input: TagUpdate, call?: CallOptions): Promise<void>

  /**
   * Referenced rule identities remain in place as unavailable. Entry records and their personal
   * facts are preserved.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Merges definitions, applications and formal references into the explicit target atomically. */
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

const dynamicRules = fromParser(parseDynamicRules)

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

/**
 * Applies NFKC, trims and collapses whitespace, and lowercases the identity key. Display spelling
 * is stored separately.
 */
export function tagNameKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

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

function memberChangeSchema<T extends v.GenericSchema<unknown, { entry: EntryRef }>>(member: T) {
  return membershipChangeSchema(member, entryRefSchema, (item) => item.entry, entryKey)
}

/** The write owner checks current membership mode and actual endpoints. */
export function parseCollectionMemberChange(input: unknown): CollectionMemberChange {
  return parseValue(memberChangeSchema(memberSchema), input, 'Invalid collection membership')
}

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
