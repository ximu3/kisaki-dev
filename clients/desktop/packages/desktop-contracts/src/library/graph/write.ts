/** @fileoverview Validates one complete graph using a shared create index and cross-region consistency checks. */

import type {
  GraphEntryCreate,
  GraphPartCreate,
  GraphTagCreate,
  GraphTagUpdate,
  GraphEntryRef,
  GraphPartRef,
} from './nodes'
import type { EntryUpdate, EntryRef, PartRef, EntryType, PartType, WorkType } from '../catalog'
import type { PartUpdate } from '../parts'
import type {
  GraphRelations,
  GraphPersonWorkAdd,
  GraphOrganizationWorkAdd,
  GraphWorkRelationAdd,
  GraphWorkCharacterAdd,
} from './relations'
import type { GraphLocalContent } from './local-content'
import type { PreparedAttachment } from '../../resources'
import * as v from 'valibot'
import {
  preparedSchema,
  entryTypes,
  partTypes,
  entryRefSchema,
  isWorkType,
  parseEntryCreate,
  parseEntryUpdate,
  workTypes,
  entryTagsSchema,
  partRefSchema,
} from '../catalog'
import { DesktopError } from '../../errors'
import {
  parseValue,
  id,
  text,
  unique,
  readRecord,
  optionalFields,
  parseDictionary,
} from '../../validation'
import { keySchema, tagKey, partKey, entryKey } from './nodes'
import { partWorkType, partCommonEntries, partSpecificEntries, parsePartUpdate } from '../parts'
import { tagEntries, parseTagCreate, parseTagUpdate } from '../organizers'
import {
  characterRoles,
  personRoles,
  organizationRoles,
  workRelationTypes,
  canUsePersonRole,
  canUseOrganizationRole,
  normalizeWorkRelation,
  parseWorkCharacterBinding,
  parsePersonWorkBinding,
  parseOrganizationWorkBinding,
  parseStoredWorkRelationBinding,
} from '../relations'
import { properties, relationEdit, actions } from './relations'
import { parseGraphLocalContent } from './local-content'

/** Every region commits together. Empty graphs succeed with changed:false and empty maps; prepared alone is not a write. */
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

/** Maps contain exactly this request's created keys; failures never return invented identities or partial maps. */
export interface LibraryWriteResult {
  readonly entries: Readonly<Record<string, EntryRef>>
  readonly parts: Readonly<Record<string, PartRef>>
  readonly tags: Readonly<Record<string, string>>
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

function invalid(message: string): never {
  throw new DesktopError('InvalidInput', message)
}

/**
 * Parse the complete graph before preparation or commit. This validates graph-local types and contradictions;
 * existing-object ownership, visibility, uniqueness, occupancy, real prepared holds and transaction baselines stay host checks.
 */
export function parseLibraryWriteGraph(input: unknown): LibraryWriteGraph {
  const raw = parseValue(rawGraphSchema, input, 'Invalid library write graph')
  const keys = new Set<string>()
  const entries = new Map<string, EntryType>()
  const parts = new Map<string, { readonly type: PartType; readonly work: GraphEntryRef }>()
  const tags = new Set<string>()

  function addKey(key: string): void {
    if (keys.has(key)) {
      invalid('Create keys must be unique across the complete graph')
    }
    keys.add(key)
  }

  // Index every created identity before resolving references across graph regions.
  for (const item of raw.entries?.create ?? []) {
    const node = parseValue(v.looseObject({ key: id, type: v.picklist(entryTypes) }), item)
    addKey(node.key)
    entries.set(node.key, node.type)
  }

  for (const item of raw.parts?.create ?? []) {
    const node = parseValue(
      v.looseObject({
        key: id,
        type: v.picklist(partTypes),
        work: v.union([entryRefSchema, keySchema]),
      }),
      item,
    )
    addKey(node.key)
    parts.set(node.key, { type: node.type, work: node.work })
  }

  for (const item of raw.tags?.create ?? []) {
    const node = parseValue(v.looseObject({ key: id }), item)
    addKey(node.key)
    tags.add(node.key)
  }

  function entryType(ref: GraphEntryRef): EntryType {
    if ('type' in ref) {
      return ref.type
    }

    const type = entries.get(ref.key)
    if (!type) {
      invalid('Graph reference does not identify an entry created in this request')
    }
    return type
  }

  function workType(ref: GraphEntryRef<WorkType>): WorkType {
    const type = entryType(ref)
    if (!isWorkType(type)) {
      invalid('Graph reference must identify a work')
    }
    return type
  }

  function entryReference<T extends EntryType>(
    types: readonly T[],
  ): v.GenericSchema<unknown, GraphEntryRef<T>> {
    return v.pipe(
      v.union([v.strictObject({ type: v.picklist(types), id }), keySchema]),
      v.check((ref) => types.some((type) => type === entryType(ref))),
    )
  }

  function partReference<T extends PartType>(
    types: readonly T[],
  ): v.GenericSchema<unknown, GraphPartRef<T>> {
    return v.pipe(
      v.union([v.strictObject({ type: v.picklist(types), id }), keySchema]),
      v.check((ref) => {
        if ('type' in ref) {
          return true
        }

        const target = parts.get(ref.key)
        return target !== undefined && types.some((type) => type === target.type)
      }),
    )
  }

  const tagReference = v.pipe(
    v.union([v.strictObject({ id }), keySchema]),
    v.check((ref) => !('key' in ref) || tags.has(ref.key)),
  )
  const graphTagMember = v.strictObject({
    tagId: tagReference,
    note: v.exactOptional(v.nullable(text)),
    isSpoiler: v.exactOptional(v.boolean()),
  })
  const graphTagMembers = v.pipe(
    v.array(graphTagMember),
    v.check((items) => unique(items, (item) => tagKey(item.tagId))),
  )

  function parseEntry(item: unknown): GraphEntryCreate {
    const source = readRecord(item)
    const { key: keyInput, tags: tagInput, ...fields } = source
    const key = parseValue(id, keyInput)
    const value = parseEntryCreate(fields)
    const members = Object.hasOwn(source, 'tags')
      ? { tags: parseValue(graphTagMembers, tagInput) }
      : {}
    return { ...value, key, ...members } as GraphEntryCreate
  }

  function parsePart(item: unknown): GraphPartCreate {
    const { type } = parseValue(v.looseObject({ type: v.picklist(partTypes) }), item)
    return parseValue(
      v.strictObject({
        key: id,
        type: v.literal(type),
        work: entryReference([partWorkType(type)]),
        data: v.strictObject(
          optionalFields({ ...partCommonEntries, ...partSpecificEntries[type] }),
        ),
        completed: v.exactOptional(v.boolean()),
      }),
      item,
    ) as GraphPartCreate
  }

  function parseTag(item: unknown): {
    readonly key: string
    readonly name: string
    readonly description?: string | null
    readonly isNsfw?: boolean
  } {
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
    const { id: tagIdInput, ...fields } = readRecord(item)
    const tagId = parseValue(id, tagIdInput)
    return { id: tagId, ...parseTagUpdate(fields) }
  }

  const parsedEntries = raw.entries
    ? {
        ...(raw.entries.create === undefined ? {} : { create: raw.entries.create.map(parseEntry) }),
        ...(raw.entries.update === undefined
          ? {}
          : { update: raw.entries.update.map(parseEntryUpdate) }),
      }
    : undefined
  const parsedParts = raw.parts
    ? {
        ...(raw.parts.create === undefined ? {} : { create: raw.parts.create.map(parsePart) }),
        ...(raw.parts.update === undefined
          ? {}
          : { update: raw.parts.update.map(parsePartUpdate) }),
      }
    : undefined
  const parsedTags = raw.tags
    ? {
        ...(raw.tags.create === undefined ? {} : { create: raw.tags.create.map(parseTag) }),
        ...(raw.tags.update === undefined ? {} : { update: raw.tags.update.map(parseTagEdit) }),
      }
    : undefined
  if (
    !unique(parsedEntries?.update ?? [], (item) => item.ref.id) ||
    !unique(parsedParts?.update ?? [], (item) => partKey(item.ref)) ||
    !unique(parsedTags?.update ?? [], (item) => item.id)
  ) {
    invalid('Each existing graph node may be updated at most once')
  }

  // Relation and local-content parsers below close over the complete create index, never the order of creation arrays.
  const work = entryReference(workTypes)
  const character = entryReference(['character'] as const)
  const person = entryReference(['person'] as const)
  const organization = entryReference(['organization'] as const)
  const characterFields = { work, character, role: v.nullable(v.picklist(characterRoles)) }
  const personFields = {
    work,
    person,
    character: v.nullable(character),
    role: v.picklist(personRoles),
  }
  const organizationFields = { work, organization, role: v.picklist(organizationRoles) }
  const relationFields = { from: work, to: work, type: v.picklist(workRelationTypes) }

  function checkPerson(value: Partial<GraphPersonWorkAdd>): void {
    if (
      value.work &&
      value.role &&
      value.character !== undefined &&
      !canUsePersonRole(value.role, workType(value.work), value.character !== null)
    ) {
      invalid('Person responsibility is not applicable to its graph work or character')
    }
  }

  function checkOrganization(value: Partial<GraphOrganizationWorkAdd>): void {
    if (value.work && value.role && !canUseOrganizationRole(value.role, workType(value.work))) {
      invalid('Organization responsibility is not applicable to its graph work')
    }
  }

  function relationKey(value: GraphWorkRelationAdd): string {
    const normalized = normalizeWorkRelation({
      from: { type: workType(value.from), id: entryKey(value.from) },
      to: { type: workType(value.to), id: entryKey(value.to) },
      type: value.type,
    })
    return JSON.stringify([normalized.from.id, normalized.to.id, normalized.type])
  }

  function checkRelation(value: Partial<GraphWorkRelationAdd>): void {
    if (value.from && value.to && value.type) {
      relationKey({ from: value.from, to: value.to, type: value.type })
    }
  }

  function characterKey(value: GraphWorkCharacterAdd): string {
    return JSON.stringify([entryKey(value.work), entryKey(value.character)])
  }

  function personKey(value: GraphPersonWorkAdd): string {
    return JSON.stringify([
      entryKey(value.work),
      entryKey(value.person),
      value.role,
      value.character === null ? null : entryKey(value.character),
    ])
  }

  function organizationKey(value: GraphOrganizationWorkAdd): string {
    return JSON.stringify([entryKey(value.work), entryKey(value.organization), value.role])
  }

  const characterBinding = v.pipe(v.unknown(), v.transform(parseWorkCharacterBinding))
  const personBinding = v.pipe(v.unknown(), v.transform(parsePersonWorkBinding))
  const organizationBinding = v.pipe(v.unknown(), v.transform(parseOrganizationWorkBinding))
  const relationBinding = v.pipe(v.unknown(), v.transform(parseStoredWorkRelationBinding))

  const characterAdd = v.strictObject({ ...characterFields, ...optionalFields(properties) })
  const personAdd = v.pipe(
    v.strictObject({ ...personFields, ...optionalFields(properties) }),
    v.transform((value) => {
      checkPerson(value)
      return value
    }),
  )
  const organizationAdd = v.pipe(
    v.strictObject({ ...organizationFields, ...optionalFields(properties) }),
    v.transform((value) => {
      checkOrganization(value)
      return value
    }),
  )
  const relationAdd = v.pipe(
    v.strictObject({ ...relationFields, note: v.exactOptional(properties.note) }),
    v.transform((value) => {
      checkRelation(value)
      return value
    }),
  )
  const personEdit = v.pipe(
    relationEdit(personFields, personBinding, true),
    v.transform((value) => {
      checkPerson({ ...value.expected?.binding, ...value.changes })
      return value
    }),
  )
  const organizationEdit = v.pipe(
    relationEdit(organizationFields, organizationBinding, true),
    v.transform((value) => {
      checkOrganization({ ...value.expected?.binding, ...value.changes })
      return value
    }),
  )
  const workRelationEdit = v.pipe(
    relationEdit(relationFields, relationBinding, false),
    v.transform((value) => {
      checkRelation({ ...value.expected?.binding, ...value.changes })
      return value
    }),
  )

  const tagChange = v.union([
    v.strictObject({ type: v.literal('replace'), items: graphTagMembers }),
    v.pipe(
      v.strictObject({
        type: v.literal('modify'),
        add: v.exactOptional(graphTagMembers),
        remove: v.exactOptional(
          v.pipe(
            v.array(tagReference),
            v.check((refs) => unique(refs, tagKey)),
          ),
        ),
      }),
      v.check(
        (value) =>
          (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
          !(value.add ?? []).some((member) =>
            value.remove?.some((ref) => tagKey(ref) === tagKey(member.tagId)),
          ),
      ),
    ),
  ])

  const volume = partReference(['comicVolume'] as const)
  const chapter = partReference(['comicChapter'] as const)
  const chapterMember = v.strictObject({ chapter, numberLabel: v.nullable(text) })
  const chapterMembers = v.pipe(
    v.array(chapterMember),
    v.check((items) => unique(items, (item) => partKey(item.chapter))),
  )
  const chapterChange = v.union([
    v.strictObject({ type: v.literal('replace'), items: chapterMembers }),
    v.pipe(
      v.strictObject({
        type: v.literal('modify'),
        add: v.exactOptional(chapterMembers),
        remove: v.exactOptional(
          v.pipe(
            v.array(chapter),
            v.check((refs) => unique(refs, partKey)),
          ),
        ),
      }),
      v.check(
        (value) =>
          (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
          !(value.add ?? []).some((member) =>
            value.remove?.some((ref) => partKey(ref) === partKey(member.chapter)),
          ),
      ),
    ),
  ])
  const existingChapters = v.pipe(
    v.array(
      v.strictObject({
        chapter: v.strictObject({ type: v.literal('comicChapter'), id }),
        numberLabel: v.nullable(text),
      }),
    ),
    v.check((items) => unique(items, (item) => item.chapter.id)),
  )

  const relations: GraphRelations | undefined =
    raw.relations === undefined
      ? undefined
      : parseValue(
          v.strictObject({
            workCharacters: v.exactOptional(
              actions(
                characterAdd,
                relationEdit(characterFields, characterBinding, true),
                v.strictObject({ id, binding: characterBinding, ...properties }),
                characterKey,
              ),
            ),
            personWorks: v.exactOptional(
              actions(
                personAdd,
                personEdit,
                v.strictObject({ id, binding: personBinding, ...properties }),
                personKey,
              ),
            ),
            organizationWorks: v.exactOptional(
              actions(
                organizationAdd,
                organizationEdit,
                v.strictObject({ id, binding: organizationBinding, ...properties }),
                organizationKey,
              ),
            ),
            workRelations: v.exactOptional(
              actions(
                relationAdd,
                workRelationEdit,
                v.strictObject({ id, binding: relationBinding, note: properties.note }),
                relationKey,
              ),
            ),
            entryTags: v.exactOptional(
              v.pipe(
                v.array(
                  v.strictObject({
                    entry: entryReference(entryTypes),
                    change: tagChange,
                    expected: v.exactOptional(entryTagsSchema),
                  }),
                ),
                v.check(
                  (items) =>
                    unique(items, (item) => entryKey(item.entry)) &&
                    items.every(
                      (item) => item.expected === undefined || item.change.type === 'replace',
                    ),
                ),
              ),
            ),
            volumeChapters: v.exactOptional(
              v.pipe(
                v.array(
                  v.strictObject({
                    volume,
                    change: chapterChange,
                    expected: v.exactOptional(existingChapters),
                  }),
                ),
                v.check(
                  (items) =>
                    unique(items, (item) => partKey(item.volume)) &&
                    items.every(
                      (item) => item.expected === undefined || item.change.type === 'replace',
                    ),
                ),
              ),
            ),
          }),
          raw.relations,
          'Invalid graph relation actions',
        )

  function requireSameKnownOwner(
    left: GraphPartRef,
    right: GraphPartRef | GraphEntryRef,
    rightIsWork: boolean,
  ): void {
    const leftOwner = 'key' in left ? parts.get(left.key)?.work : undefined
    let rightOwner: GraphEntryRef | undefined
    if (rightIsWork) {
      rightOwner = right as GraphEntryRef
    } else if ('key' in right) {
      rightOwner = parts.get(right.key)?.work
    }
    if (leftOwner && rightOwner && entryKey(leftOwner) !== entryKey(rightOwner)) {
      invalid('Graph parts and local files must share the same real work')
    }
  }

  for (const item of relations?.volumeChapters ?? []) {
    const chapters =
      item.change.type === 'replace'
        ? item.change.items.map((item) => item.chapter)
        : [...(item.change.add ?? []).map((item) => item.chapter), ...(item.change.remove ?? [])]
    for (const chapter of chapters) {
      requireSameKnownOwner(chapter, item.volume, false)
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
    invalid('An entry tag set cannot be written through two graph regions')
  }

  const removedCharacterBindings = new Set(
    (relations?.workCharacters?.expected ?? []).map((item) => characterKey(item.binding)),
  )
  for (const item of relations?.personWorks?.add ?? []) {
    if (
      item.character &&
      removedCharacterBindings.has(
        characterKey({ work: item.work, character: item.character, role: null }),
      )
    ) {
      invalid('A character-specific work cannot depend on a removed work-character relation')
    }
  }

  const localContent = parseGraphLocalContent(raw.localContent, entryReference, partReference)

  const localPaths = new Set<string>()
  for (const type of workTypes) {
    const groups = localContent?.[type] ?? []
    for (const group of groups) {
      for (const directory of group.directories ?? []) {
        const key = JSON.stringify([entryKey(group.work), 'directory', directory.path])
        if (localPaths.has(key)) {
          invalid('Initial directory paths must not be duplicated')
        }
        localPaths.add(key)
      }
      if (type === 'game' || !('files' in group)) {
        continue
      }

      for (const file of group.files ?? []) {
        const key = JSON.stringify([entryKey(group.work), 'file', file.path])
        if (localPaths.has(key)) {
          invalid('Initial file paths must not be duplicated')
        }
        localPaths.add(key)

        for (const association of file.associations ?? []) {
          requireSameKnownOwner(association.part, group.work, true)
        }
      }
    }
  }

  return {
    ...(parsedEntries ? { entries: parsedEntries } : {}),
    ...(parsedParts ? { parts: parsedParts } : {}),
    ...(parsedTags ? { tags: parsedTags } : {}),
    ...(relations ? { relations } : {}),
    ...(localContent ? { localContent } : {}),
    ...(raw.prepared === undefined ? {} : { prepared: raw.prepared }),
  }
}

/** Validate a graph's complete creation maps against its already parsed request; empty maps never stand in for failed creates. */
export function parseLibraryWriteResult(
  input: unknown,
  request: LibraryWriteGraph,
): LibraryWriteResult {
  const value = parseValue(
    v.strictObject({
      entries: v.pipe(
        v.unknown(),
        v.transform((value) => parseDictionary(id, entryRefSchema, value)),
      ),
      parts: v.pipe(
        v.unknown(),
        v.transform((value) => parseDictionary(id, partRefSchema, value)),
      ),
      tags: v.pipe(
        v.unknown(),
        v.transform((value) => parseDictionary(id, id, value)),
      ),
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
      invalid('Graph result must map exactly the successfully created keys')
    }
  }

  exactKeys(value.entries, request.entries?.create ?? [])
  exactKeys(value.parts, request.parts?.create ?? [])
  exactKeys(value.tags, request.tags?.create ?? [])

  if (
    request.entries?.create?.some((item) => value.entries[item.key]?.type !== item.type) ||
    request.parts?.create?.some((item) => value.parts[item.key]?.type !== item.type)
  ) {
    invalid('Graph result identity kinds must match the requested creates')
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
    invalid('Graph result contains inconsistent created identities')
  }
  return value
}
