/** @fileoverview Validates complete candidate graphs, local answer keys, and root-scoped relation endpoints. */

import * as v from 'valibot'
import { invalidInput } from '../errors'
import { externalIdentitiesSchema } from '../library/catalog'
import {
  entryTypes,
  externalIdentitySchema,
  workTypes,
  type EntryType,
  type ExternalIdentity,
  type PartType,
} from '../library/identity'
import {
  isOrganizationRoleAllowed,
  isPersonRoleAllowed,
  isWorkRelationAllowed,
  normalizeWorkRelation,
} from '../library/relations'
import { objectSchema } from '../schema'
import { exactPartialEntries, nonemptyStringSchema, parseContract } from '../validation'
import {
  metadataEntryFields,
  metadataPartFields,
  type MetadataEntryFields,
  type MetadataPartFields,
} from './fields'
import {
  identificationFields,
  partIdentificationFields,
  type IdentificationFields,
  type PartIdentificationFields,
} from './identification'
import { partMatchingSchemas, type PartMatchingRules } from './matching'
import { candidateRelationSchemas, type CandidateRelations } from './relations'

/** Directly evidenced source identities are independent of unprocessed clues and adopted fields. */
export interface CandidateEntry<Type extends EntryType> {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
  readonly identification: IdentificationFields<Type>
  readonly fields: MetadataEntryFields<Type>
}
export interface CandidatePart<Type extends PartType> {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
  readonly identification: PartIdentificationFields<Type>
  readonly fields: MetadataPartFields<Type>
}
export interface CandidateTag {
  readonly key: string
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
}
export type CandidateRelatedEntries = {
  readonly [Type in EntryType]?: readonly CandidateEntry<Type>[]
}
export type CandidateParts<Type extends EntryType> = {
  game: never
  anime: {
    readonly episode?: readonly CandidatePart<'animeEpisode'>[]
    readonly extra?: readonly CandidatePart<'animeExtra'>[]
  }
  comic: {
    readonly volume?: readonly CandidatePart<'comicVolume'>[]
    readonly chapter?: readonly CandidatePart<'comicChapter'>[]
  }
  novel: { readonly volume?: readonly CandidatePart<'novelVolume'>[] }
  character: never
  person: never
  organization: never
}[Type]
/** One call's source graph. It contains no local IDs, create/update decisions, or persistent temporary keys. */
export type MetadataCandidate<Type extends EntryType = EntryType> = {
  [Kind in Type]: {
    readonly entryType: Kind
    readonly objects: {
      readonly entry: CandidateEntry<Kind>
      readonly relatedEntries?: CandidateRelatedEntries
      readonly parts?: CandidateParts<Kind>
      readonly tags?: readonly CandidateTag[]
    }
    readonly relations?: CandidateRelations<Kind>
    readonly partMatching?: PartMatchingRules<Kind>
  }
}[Type]

export const sourceIdentityFields = {
  key: nonemptyStringSchema,
  identity: v.exactOptional(externalIdentitySchema),
  externalIdentities: v.exactOptional(externalIdentitiesSchema),
}
function candidateObject<Identification extends v.ObjectEntries, Fields extends v.ObjectEntries>(
  identification: Identification,
  fields: Fields,
) {
  return objectSchema({
    ...sourceIdentityFields,
    identification: objectSchema(identification),
    fields: objectSchema(exactPartialEntries(fields)),
  })
}
export const candidateEntrySchemas = {
  game: candidateObject(identificationFields.game, metadataEntryFields.game),
  anime: candidateObject(identificationFields.anime, metadataEntryFields.anime),
  comic: candidateObject(identificationFields.comic, metadataEntryFields.comic),
  novel: candidateObject(identificationFields.novel, metadataEntryFields.novel),
  character: candidateObject(identificationFields.character, metadataEntryFields.character),
  person: candidateObject(identificationFields.person, metadataEntryFields.person),
  organization: candidateObject(
    identificationFields.organization,
    metadataEntryFields.organization,
  ),
}
const candidatePartSchemas = {
  animeEpisode: candidateObject(
    partIdentificationFields.animeEpisode,
    metadataPartFields.animeEpisode,
  ),
  animeExtra: candidateObject(partIdentificationFields.animeExtra, metadataPartFields.animeExtra),
  comicVolume: candidateObject(
    partIdentificationFields.comicVolume,
    metadataPartFields.comicVolume,
  ),
  comicChapter: candidateObject(
    partIdentificationFields.comicChapter,
    metadataPartFields.comicChapter,
  ),
  novelVolume: candidateObject(
    partIdentificationFields.novelVolume,
    metadataPartFields.novelVolume,
  ),
}
export const candidateTagSchema = objectSchema({
  key: nonemptyStringSchema,
  name: nonemptyStringSchema,
  description: v.exactOptional(v.nullable(v.string())),
  isNsfw: v.exactOptional(v.boolean()),
})
const relatedEntries = objectSchema(
  exactPartialEntries({
    game: v.pipe(v.array(candidateEntrySchemas.game), v.readonly()),
    anime: v.pipe(v.array(candidateEntrySchemas.anime), v.readonly()),
    comic: v.pipe(v.array(candidateEntrySchemas.comic), v.readonly()),
    novel: v.pipe(v.array(candidateEntrySchemas.novel), v.readonly()),
    character: v.pipe(v.array(candidateEntrySchemas.character), v.readonly()),
    person: v.pipe(v.array(candidateEntrySchemas.person), v.readonly()),
    organization: v.pipe(v.array(candidateEntrySchemas.organization), v.readonly()),
  }),
)
const parts = {
  anime: objectSchema(
    exactPartialEntries({
      episode: v.pipe(v.array(candidatePartSchemas.animeEpisode), v.readonly()),
      extra: v.pipe(v.array(candidatePartSchemas.animeExtra), v.readonly()),
    }),
  ),
  comic: objectSchema(
    exactPartialEntries({
      volume: v.pipe(v.array(candidatePartSchemas.comicVolume), v.readonly()),
      chapter: v.pipe(v.array(candidatePartSchemas.comicChapter), v.readonly()),
    }),
  ),
  novel: objectSchema(
    exactPartialEntries({
      volume: v.pipe(v.array(candidatePartSchemas.novelVolume), v.readonly()),
    }),
  ),
}
function candidateSchema<const Type extends EntryType, Entry, Parts, Relations, Matching>(
  type: Type,
  entry: v.GenericSchema<unknown, Entry>,
  part: v.GenericSchema<unknown, Parts>,
  relations: v.GenericSchema<unknown, Relations>,
  matching: v.GenericSchema<unknown, Matching>,
) {
  return objectSchema({
    entryType: v.literal(type),
    objects: objectSchema({
      entry,
      relatedEntries: v.exactOptional(relatedEntries),
      parts: v.exactOptional(part),
      tags: v.exactOptional(v.pipe(v.array(candidateTagSchema), v.readonly())),
    }),
    relations: v.exactOptional(relations),
    partMatching: v.exactOptional(matching),
  })
}
const candidateSchemas: { [Type in EntryType]: v.GenericSchema<unknown, MetadataCandidate<Type>> } =
  {
    game: candidateSchema(
      'game',
      candidateEntrySchemas.game,
      v.never(),
      candidateRelationSchemas.game,
      partMatchingSchemas.game,
    ),
    anime: candidateSchema(
      'anime',
      candidateEntrySchemas.anime,
      parts.anime,
      candidateRelationSchemas.anime,
      partMatchingSchemas.anime,
    ),
    comic: candidateSchema(
      'comic',
      candidateEntrySchemas.comic,
      parts.comic,
      candidateRelationSchemas.comic,
      partMatchingSchemas.comic,
    ),
    novel: candidateSchema(
      'novel',
      candidateEntrySchemas.novel,
      parts.novel,
      candidateRelationSchemas.novel,
      partMatchingSchemas.novel,
    ),
    character: candidateSchema(
      'character',
      candidateEntrySchemas.character,
      v.never(),
      candidateRelationSchemas.character,
      partMatchingSchemas.character,
    ),
    person: candidateSchema(
      'person',
      candidateEntrySchemas.person,
      v.never(),
      candidateRelationSchemas.person,
      partMatchingSchemas.person,
    ),
    organization: candidateSchema(
      'organization',
      candidateEntrySchemas.organization,
      v.never(),
      candidateRelationSchemas.organization,
      partMatchingSchemas.organization,
    ),
  }

/** Check the entire graph before adoption; missing local facts and source completeness remain the operation's responsibility. */
export function parseMetadataCandidate<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataCandidate<Type>
export function parseMetadataCandidate(type: EntryType, input: unknown): MetadataCandidate {
  const candidate = parseContract<MetadataCandidate>(
    candidateSchemas[type],
    input,
    'metadata candidate',
  )
  validateSourceGraph(candidate.entryType, candidate.objects, candidate.relations ?? {})
  return candidate
}

interface AnswerNode {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
}
interface AnswerNodes {
  readonly entry?: AnswerNode
  readonly relatedEntries?: { readonly [Type in EntryType]?: readonly AnswerNode[] }
  readonly parts?: {
    readonly volume?: readonly AnswerNode[]
    readonly chapter?: readonly AnswerNode[]
    readonly episode?: readonly AnswerNode[]
    readonly extra?: readonly AnswerNode[]
  }
  readonly tags?: readonly AnswerNode[]
}

/** Check source graph identities and endpoints after the owning answer parser has established its exact fields. */
export function validateSourceGraph(
  rootType: EntryType,
  objects: AnswerNodes,
  relations: CandidateRelations,
): void {
  const nodes = new Map<string, EntryType | PartType | 'tag'>()
  const add = (node: AnswerNode, kind: EntryType | PartType | 'tag') => {
    if (nodes.has(node.key)) {
      invalidInput('Source keys must be unique across the whole graph.')
    }
    if (
      node.identity &&
      node.externalIdentities?.some(
        (identity) =>
          identity.source === node.identity?.source && identity.sourceId === node.identity.sourceId,
      )
    ) {
      invalidInput('The primary identity cannot be repeated as another identity.')
    }
    nodes.set(node.key, kind)
  }
  if (objects.entry) {
    add(objects.entry, rootType)
  }
  for (const kind of entryTypes) {
    for (const entry of objects.relatedEntries?.[kind] ?? []) {
      add(entry, kind)
    }
  }
  for (const part of objects.parts?.episode ?? []) {
    add(part, 'animeEpisode')
  }
  for (const part of objects.parts?.extra ?? []) {
    add(part, 'animeExtra')
  }
  for (const part of objects.parts?.volume ?? []) {
    add(part, rootType === 'novel' ? 'novelVolume' : 'comicVolume')
  }
  for (const part of objects.parts?.chapter ?? []) {
    add(part, 'comicChapter')
  }
  for (const tag of objects.tags ?? []) {
    add(tag, 'tag')
  }
  validateMetadataRelations(rootType, objects.entry?.key, nodes, relations)
}

/** Verify one answer's endpoint types and root ownership, shared by candidates and direct provider answers. */
export function validateMetadataRelations(
  rootType: EntryType,
  rootKey: string | undefined,
  nodes: ReadonlyMap<string, EntryType | PartType | 'tag'>,
  relations: CandidateRelations,
): void {
  const endpoint = <Type extends EntryType | PartType | 'tag'>(
    key: string,
    kinds: readonly Type[],
  ): Type => {
    const found = nodes.get(key)
    const kind = kinds.find((candidate) => candidate === found)
    if (kind === undefined) {
      return invalidInput('Metadata relationship has a missing or wrong-kind endpoint.')
    }
    return kind
  }
  const root = (key: string) => {
    if (key !== rootKey) {
      invalidInput('Metadata relationship is outside the root context.')
    }
  }
  const seen = new Set<string>()
  const unique = (...key: readonly (string | null)[]) => {
    const encoded = JSON.stringify(key)
    if (seen.has(encoded)) {
      invalidInput('Duplicate metadata relationship.')
    }
    seen.add(encoded)
  }
  for (const relation of relations.workCharacters ?? []) {
    endpoint(relation.work, workTypes)
    endpoint(relation.character, ['character'])
    root(rootType === 'character' ? relation.character : relation.work)
    unique('workCharacters', relation.work, relation.character)
  }
  for (const relation of relations.personWorks ?? []) {
    const work = endpoint(relation.work, workTypes)
    endpoint(relation.person, ['person'])
    if (relation.character !== null) {
      endpoint(relation.character, ['character'])
    }
    if (!isPersonRoleAllowed(relation.role, work, relation.character !== null)) {
      invalidInput('Invalid person role in metadata relationship.')
    }
    if (rootType === 'person') {
      root(relation.person)
    } else if (rootType === 'character') {
      root(relation.character ?? '')
    } else {
      root(relation.work)
    }
    unique('personWorks', relation.work, relation.person, relation.role, relation.character)
  }
  for (const relation of relations.organizationWorks ?? []) {
    const work = endpoint(relation.work, workTypes)
    endpoint(relation.organization, ['organization'])
    if (!isOrganizationRoleAllowed(relation.role, work)) {
      invalidInput('Invalid organization role in metadata relationship.')
    }
    root(rootType === 'organization' ? relation.organization : relation.work)
    unique('organizationWorks', relation.work, relation.organization, relation.role)
  }
  for (const relation of relations.workRelations ?? []) {
    const from = { id: relation.from, type: endpoint(relation.from, workTypes) }
    const to = { id: relation.to, type: endpoint(relation.to, workTypes) }
    if (
      !isWorkRelationAllowed({ from, to, type: relation.type }) ||
      (relation.from !== rootKey && relation.to !== rootKey)
    ) {
      invalidInput('Invalid work relationship in metadata.')
    }
    const normalized = normalizeWorkRelation({ from, to, type: relation.type })
    unique('workRelations', normalized.from.id, normalized.to.id, normalized.type)
  }
  for (const relation of relations.entryTags ?? []) {
    endpoint(relation.entry, entryTypes)
    endpoint(relation.tag, ['tag'])
    root(relation.entry)
    unique('entryTags', relation.entry, relation.tag)
  }
  const partRelations: readonly {
    readonly work: string
    readonly part: string
    readonly kind: PartType
  }[] = [
    ...(relations.workVolumes ?? []).map((item) => ({
      work: item.work,
      part: item.volume,
      kind: rootType === 'novel' ? ('novelVolume' as const) : ('comicVolume' as const),
    })),
    ...(relations.workChapters ?? []).map((item) => ({
      work: item.work,
      part: item.chapter,
      kind: 'comicChapter' as const,
    })),
    ...(relations.workEpisodes ?? []).map((item) => ({
      work: item.work,
      part: item.episode,
      kind: 'animeEpisode' as const,
    })),
    ...(relations.workExtras ?? []).map((item) => ({
      work: item.work,
      part: item.extra,
      kind: 'animeExtra' as const,
    })),
  ]
  for (const relation of partRelations) {
    endpoint(relation.work, workTypes)
    endpoint(relation.part, [relation.kind])
    root(relation.work)
    unique('part', relation.work, relation.part)
  }
  for (const relation of relations.volumeChapters ?? []) {
    endpoint(relation.volume, ['comicVolume'])
    endpoint(relation.chapter, ['comicChapter'])
    unique('volumeChapters', relation.volume, relation.chapter)
  }
}
