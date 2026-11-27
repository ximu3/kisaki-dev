import { membershipChangeSchema } from './membership'
import type {
  StoredValue,
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

export type Collection = CollectionFields & {
  readonly id: string
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
} & (
    | { readonly membershipMode: 'manual'; readonly dynamicRules: null }
    | { readonly membershipMode: 'dynamic'; readonly dynamicRules: StoredValue<DynamicRules> }
  )

export interface Tag extends TagFields {
  readonly id: string
  readonly nameKey: string
  readonly createdAt: number
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

export interface OrganizerMerge {
  readonly sourceIds: NonEmptyArray<string>
  readonly targetId: string
}

export interface OrganizerMergeResult {
  readonly targetId: string
  readonly removedIds: readonly string[]
}

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

export function parseCollectionMemberChange(input: unknown): CollectionMemberChange {
  return parseValue(memberChangeSchema(memberSchema), input, 'Invalid collection membership')
}

export function parseTagEntryChange(input: unknown): TagEntryChange {
  return parseValue(memberChangeSchema(tagEntrySchema), input, 'Invalid tag applications')
}

export function validateMembershipExpected(
  change: CollectionMemberChange | TagEntryChange,
  expected: readonly unknown[] | undefined,
): void {
  if (expected !== undefined && change.type !== 'replace') {
    throw new DesktopError('InvalidInput', 'A membership baseline requires complete replacement')
  }
}
