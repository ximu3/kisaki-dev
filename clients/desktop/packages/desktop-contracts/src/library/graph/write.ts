import * as v from 'valibot'
import { DesktopError } from '../../errors'
import {
  fromParser,
  id,
  optionalFields,
  parseDictionary,
  parseRecord,
  parseValue,
  unique,
} from '../../validation'
import type { PreparedAttachment } from '../../resources'
import type { KeyedResult } from '../../operations'
import {
  entryRefSchema,
  partRefSchema,
  partTypes,
  preparedSchema,
  parseEntryCreate,
  parseEntryUpdate,
  type EntryRef,
  type PartRef,
  type EntryUpdate,
} from '../catalog'
import { parseTagCreate, parseTagUpdate, tagEntries } from '../organizers'
import {
  partCommonEntries,
  partSpecificEntries,
  partWorkType,
  parsePartUpdate,
  type PartUpdate,
} from '../parts'
import {
  entryKey,
  partKey,
  tagKey,
  type GraphEntryCreate,
  type GraphTagMember,
  type GraphPartCreate,
  type GraphTagCreate,
  type GraphTagUpdate,
} from './nodes'
import { bindingEdits, checkRemovedCharacterBindings } from './bindings'
import { distinctMembers } from '../membership'
import { membershipEdits, tagMemberSchema } from './memberships'
import { indexGraphReferences, type GraphReferences } from './references'
import type { GraphRelations } from './relations'
import { parseGraphLocalContent, type GraphLocalContent } from './local-content'

export interface LibraryWriteGraph {
  readonly entries?: {
    readonly create?: readonly GraphEntryCreate[]
    readonly update?: readonly EntryUpdate[]
  }

  readonly parts?: {
    readonly create?: readonly GraphPartCreate[]
    readonly update?: readonly PartUpdate[]
  }

  readonly tags?: {
    readonly create?: readonly GraphTagCreate[]
    readonly update?: readonly GraphTagUpdate[]
  }

  readonly relations?: GraphRelations
  readonly localContent?: GraphLocalContent

  readonly prepared?: readonly PreparedAttachment[]
}

type CreatedItems<Region> = Region extends {
  readonly create: infer Items extends readonly { readonly key: string }[]
}
  ? Items
  : Region extends { readonly create?: readonly (infer Node extends { readonly key: string })[] }
    ? readonly Node[] | undefined
    : undefined

export interface LibraryWriteResult<G extends LibraryWriteGraph = LibraryWriteGraph> {
  readonly entries: KeyedResult<
    CreatedItems<G['entries']>,
    {
      readonly [
        Node in Extract<
          NonNullable<CreatedItems<G['entries']>>[number],
          GraphEntryCreate
        > as Node['key']
      ]: EntryRef<Node['type']>
    }
  >
  readonly parts: KeyedResult<
    CreatedItems<G['parts']>,
    {
      readonly [
        Node in Extract<
          NonNullable<CreatedItems<G['parts']>>[number],
          GraphPartCreate
        > as Node['key']
      ]: PartRef<Node['type']>
    }
  >
  readonly tags: KeyedResult<
    CreatedItems<G['tags']>,
    {
      readonly [
        Node in Extract<NonNullable<CreatedItems<G['tags']>>[number], GraphTagCreate> as Node['key']
      ]: string
    }
  >
  readonly changed: boolean
}

const present = v.pipe(
  v.unknown(),
  v.check((value) => value !== undefined),
)

const rawActions = v.strictObject({
  create: v.exactOptional(v.array(v.unknown())),
  update: v.exactOptional(v.array(v.unknown())),
})

const rawGraphSchema = v.strictObject({
  entries: v.exactOptional(rawActions),
  parts: v.exactOptional(rawActions),
  tags: v.exactOptional(rawActions),
  relations: v.exactOptional(present),
  localContent: v.exactOptional(present),
  prepared: v.exactOptional(v.array(preparedSchema)),
})

function parseEntry(
  item: unknown,
  graphTagMembers: v.GenericSchema<unknown, readonly GraphTagMember[]>,
): GraphEntryCreate {
  const source = parseRecord(item)
  const { key: keyInput, tags: tagInput, ...fields } = source
  const key = parseValue(id, keyInput)
  const value = parseEntryCreate(fields)
  const members = Object.hasOwn(source, 'tags')
    ? { tags: parseValue(graphTagMembers, tagInput) }
    : {}
  return { ...value, key, ...members } as GraphEntryCreate
}

function parsePart(item: unknown, { entryReference }: GraphReferences): GraphPartCreate {
  const { type } = parseValue(v.looseObject({ type: v.picklist(partTypes) }), item)
  return parseValue(
    v.strictObject({
      key: id,
      type: v.literal(type),
      work: entryReference([partWorkType(type)]),
      data: v.strictObject(optionalFields({ ...partCommonEntries, ...partSpecificEntries[type] })),
      completed: v.exactOptional(v.boolean()),
    }),
    item,
  ) as GraphPartCreate
}

function parseTag(item: unknown): GraphTagCreate {
  const { key, ...fields } = parseValue(
    v.strictObject({
      key: id,
      name: tagEntries.name,
      description: v.exactOptional(tagEntries.description),
      isNsfw: v.exactOptional(tagEntries.isNsfw),
    }),
    item,
  )
  return { key, ...parseTagCreate(fields) }
}

function parseTagEdit(item: unknown) {
  const { id: tagIdInput, ...fields } = parseRecord(item)
  const tagId = parseValue(id, tagIdInput)
  return { id: tagId, ...parseTagUpdate(fields) }
}

function parseNodeEdits<Create, Update>(
  region: v.InferOutput<typeof rawActions> | undefined,
  parseCreate: (value: unknown) => Create,
  parseUpdate: (value: unknown) => Update,
) {
  if (!region) {
    return
  }
  return {
    ...(region.create && { create: region.create.map(parseCreate) }),
    ...(region.update && { update: region.update.map(parseUpdate) }),
  }
}

export function parseLibraryWriteGraph(input: unknown): LibraryWriteGraph {
  const raw = parseValue(rawGraphSchema, input, 'Invalid library write graph')
  const references = indexGraphReferences(raw)
  const tagMember = tagMemberSchema(references.tagReference)
  const tagMembers = distinctMembers(tagMember, (member) => tagKey(member.tagId))
  const parsedEntries = parseNodeEdits(
    raw.entries,
    (item) => parseEntry(item, tagMembers),
    parseEntryUpdate,
  )
  const parsedParts = parseNodeEdits(
    raw.parts,
    (item) => parsePart(item, references),
    parsePartUpdate,
  )
  const parsedTags = parseNodeEdits(raw.tags, parseTag, parseTagEdit)

  if (
    !unique(parsedEntries?.update ?? [], (item) => item.ref.id) ||
    !unique(parsedParts?.update ?? [], (item) => partKey(item.ref)) ||
    !unique(parsedTags?.update ?? [], (item) => item.id)
  ) {
    throw new DesktopError('InvalidInput', 'Each existing graph node may be updated at most once')
  }

  const relations: GraphRelations | undefined =
    raw.relations === undefined
      ? undefined
      : parseValue(
          v.strictObject({
            ...bindingEdits(references),
            ...membershipEdits(references, tagMember),
          }),
          raw.relations,
          'Invalid graph relation actions',
        )

  for (const item of relations?.volumeChapters ?? []) {
    const chapters =
      item.change.type === 'replace'
        ? item.change.items.map((item) => item.chapter)
        : [...(item.change.add ?? []).map((item) => item.chapter), ...(item.change.remove ?? [])]
    for (const chapter of chapters) {
      references.requirePartOwner(chapter, references.partOwner(item.volume))
    }
  }

  const tagOwners = new Set<string>()
  for (const entry of parsedEntries?.create ?? []) {
    if (entry.tags !== undefined) {
      tagOwners.add(entryKey({ key: entry.key }))
    }
  }

  for (const entry of parsedEntries?.update ?? []) {
    if (entry.changes.tags !== undefined) {
      tagOwners.add(entryKey(entry.ref))
    }
  }
  if (relations?.entryTags?.some((item) => tagOwners.has(entryKey(item.entry)))) {
    throw new DesktopError(
      'InvalidInput',
      'An entry tag set cannot be written through two graph regions',
    )
  }

  checkRemovedCharacterBindings(relations)
  const localContent = parseGraphLocalContent(raw.localContent, references)

  return {
    ...(parsedEntries ? { entries: parsedEntries } : {}),
    ...(parsedParts ? { parts: parsedParts } : {}),
    ...(parsedTags ? { tags: parsedTags } : {}),
    ...(relations ? { relations } : {}),
    ...(localContent ? { localContent } : {}),
    ...(raw.prepared === undefined ? {} : { prepared: raw.prepared }),
  }
}

export function parseLibraryWriteResult<const G extends LibraryWriteGraph>(
  input: unknown,
  request: G,
): LibraryWriteResult<G>

export function parseLibraryWriteResult(
  input: unknown,
  request: LibraryWriteGraph,
): LibraryWriteResult {
  const value = parseValue(
    v.strictObject({
      entries: fromParser((value) => parseDictionary(id, entryRefSchema, value)),
      parts: fromParser((value) => parseDictionary(id, partRefSchema, value)),
      tags: fromParser((value) => parseDictionary(id, id, value)),
      changed: v.boolean(),
    }),
    input,
    'Invalid graph write result',
  )

  function exactKeys(actual: object, expected: readonly { readonly key: string }[]): void {
    if (
      Object.keys(actual).length !== expected.length ||
      expected.some((item) => !Object.hasOwn(actual, item.key))
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Graph result must map exactly the successfully created keys',
      )
    }
  }

  exactKeys(value.entries, request.entries?.create ?? [])
  exactKeys(value.parts, request.parts?.create ?? [])
  exactKeys(value.tags, request.tags?.create ?? [])

  if (
    request.entries?.create?.some((item) => value.entries[item.key]?.type !== item.type) ||
    request.parts?.create?.some((item) => value.parts[item.key]?.type !== item.type)
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Graph result identity kinds must match the requested creates',
    )
  }

  const entries = Object.values(value.entries)
  const parts = Object.values(value.parts)
  const tags = Object.values(value.tags)
  if (
    !unique(entries, (ref) => ref.id) ||
    !unique(parts, partKey) ||
    !unique(tags, (id) => id) ||
    (!value.changed && entries.length + parts.length + tags.length > 0)
  ) {
    throw new DesktopError('InvalidInput', 'Graph result contains inconsistent created identities')
  }
  return value
}
