/** @fileoverview Validates source and composed metadata graphs without turning their keys into local write instructions. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import { id, optionalFields, parseValue, text, unique } from '../validation'
import {
  entryTypes,
  identitiesSchema,
  identityKey,
  identitySchema,
  isWorkType,
} from '../library/catalog'
import type { EntryType, ExternalIdentity, PartType, WorkType } from '../library/catalog'
import {
  canUseOrganizationRole,
  canUsePersonRole,
  normalizeWorkRelation,
  organizationRoles,
  personRoles,
  reverseWorkRelationType,
  workRelationTypes,
} from '../library/relations'
import type { WorkRelationType } from '../library/relations'
import {
  identificationEntries,
  metadataEntryEntries,
  metadataPartEntries,
  metadataRelationAttributeEntries,
  parseIdentificationFields,
  parseMetadataEntryFields,
  parseMetadataPartFields,
  parsePartIdentificationFields,
  partIdentificationEntries,
} from './fields'
import type {
  IdentificationFields,
  MetadataEntryFields,
  MetadataPartFields,
  PartIdentificationFields,
} from './fields'
import { parsePartMatchingRules } from './matching'
import { getMetadataRelations } from './relations'
import type { MetadataRelationMembers, MetadataRelations } from './relations'
import { parseMetadataReadRequest } from './requests'
import { metadataPartKinds } from './values'
import type {
  CandidateTag,
  MetadataCandidate,
  MetadataReadRequest,
  MetadataReadResult,
} from './values'

interface ParsedNode {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
}

interface ParsedCandidateNode extends ParsedNode {
  readonly identification: IdentificationFields<EntryType> | PartIdentificationFields<PartType>
  readonly fields: MetadataEntryFields<EntryType> | MetadataPartFields<PartType>
}

interface ParsedObjects {
  readonly entry?: ParsedNode
  readonly relatedEntries?: Partial<Record<EntryType, readonly ParsedNode[]>>
  readonly parts?: Readonly<Partial<Record<string, readonly ParsedNode[]>>>
  readonly tags?: readonly CandidateTag[]
}

interface ParsedCandidateObjects extends ParsedObjects {
  readonly entry: ParsedCandidateNode
  readonly relatedEntries?: Partial<Record<EntryType, readonly ParsedCandidateNode[]>>
  readonly parts?: Readonly<Partial<Record<string, readonly ParsedCandidateNode[]>>>
}

interface NodeKind {
  readonly object: 'entry' | 'part' | 'tag'
  readonly type: EntryType | PartType | 'tag'
}

const identityEntries = {
  key: id,
  identity: v.exactOptional(identitySchema),
  externalIdentities: v.exactOptional(identitiesSchema),
}

function checkIdentities<T extends ParsedNode>(node: T): T {
  if (
    node.identity &&
    node.externalIdentities?.some(
      (identity) => identityKey(identity) === identityKey(node.identity!),
    )
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Additional metadata identities must exclude the primary identity',
    )
  }

  return node
}

function sourceEntry(type: EntryType): v.GenericSchema<unknown, ParsedNode> {
  return v.pipe(
    v.strictObject({ ...identityEntries, ...optionalFields(metadataEntryEntries(type)) }),
    v.transform(checkIdentities),
  )
}

function sourcePart(type: PartType): v.GenericSchema<unknown, ParsedNode> {
  return v.pipe(
    v.strictObject({ ...identityEntries, ...optionalFields(metadataPartEntries(type)) }),
    v.transform(checkIdentities),
  )
}

function candidateEntry(type: EntryType): v.GenericSchema<unknown, ParsedCandidateNode> {
  return v.pipe(
    v.strictObject({
      ...identityEntries,
      identification: v.pipe(
        v.unknown(),
        v.transform((value) => parseIdentificationFields(type, value)),
      ),
      fields: v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataEntryFields(type, value)),
      ),
    }),
    v.transform(checkIdentities),
  )
}

function candidatePart(type: PartType): v.GenericSchema<unknown, ParsedCandidateNode> {
  return v.pipe(
    v.strictObject({
      ...identityEntries,
      identification: v.pipe(
        v.unknown(),
        v.transform((value) => parsePartIdentificationFields(type, value)),
      ),
      fields: v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataPartFields(type, value)),
      ),
    }),
    v.transform(checkIdentities),
  )
}

function objectsSchema(
  root: EntryType,
  composed: true,
): v.GenericSchema<unknown, ParsedCandidateObjects>
function objectsSchema(root: EntryType, composed: false): v.GenericSchema<unknown, ParsedObjects>
function objectsSchema(
  root: EntryType,
  composed: boolean,
): v.GenericSchema<unknown, ParsedObjects> {
  const entry = composed ? candidateEntry : sourceEntry
  const part = composed ? candidatePart : sourcePart
  const related = Object.fromEntries(
    entryTypes.map((type) => [type, v.exactOptional(v.array(entry(type)))]),
  )

  const parts = Object.fromEntries(
    Object.entries(metadataPartKinds[root]).map(([slot, type]) => [
      slot,
      v.exactOptional(v.array(part(type))),
    ]),
  )

  const tag = v.strictObject({
    key: id,
    name: v.pipe(
      text,
      v.check((value) => value.trim().length > 0),
    ),
    description: v.exactOptional(v.nullable(text)),
    isNsfw: v.exactOptional(v.boolean()),
  })
  return v.strictObject({
    entry: composed ? entry(root) : v.exactOptional(entry(root)),
    relatedEntries: v.exactOptional(v.strictObject(related)),
    parts: v.exactOptional(Object.keys(parts).length > 0 ? v.strictObject(parts) : v.never()),
    tags: v.exactOptional(v.array(tag)),
  })
}

function relationSchemas(root: EntryType) {
  const shapes = {
    workCharacters: v.strictObject({
      work: id,
      character: id,
      ...optionalFields(metadataRelationAttributeEntries.workCharacters),
    }),

    personWorks: v.strictObject({
      work: id,
      person: id,
      role: v.picklist(personRoles),
      character: v.nullable(id),
      ...optionalFields(metadataRelationAttributeEntries.personWorks),
    }),

    organizationWorks: v.strictObject({
      work: id,
      organization: id,
      role: v.picklist(organizationRoles),
      ...optionalFields(metadataRelationAttributeEntries.organizationWorks),
    }),

    workRelations: v.strictObject({
      from: id,
      to: id,
      type: v.picklist(workRelationTypes),
      ...optionalFields(metadataRelationAttributeEntries.workRelations),
    }),

    workVolumes: v.strictObject({ work: id, volume: id }),
    workChapters: v.strictObject({ work: id, chapter: id }),
    workEpisodes: v.strictObject({ work: id, episode: id }),
    workExtras: v.strictObject({ work: id, extra: id }),

    volumeChapters: v.strictObject({
      volume: id,
      chapter: id,
      ...optionalFields(metadataRelationAttributeEntries.volumeChapters),
    }),

    entryTags: v.strictObject({
      entry: id,
      tag: id,
      ...optionalFields(metadataRelationAttributeEntries.entryTags),
    }),
  }
  return v.strictObject(
    Object.fromEntries(
      getMetadataRelations(root).map((key) => [key, v.exactOptional(v.array(shapes[key]))]),
    ),
  )
}

function validateGraph(
  root: EntryType,
  objects: ParsedObjects | undefined,
  relations: MetadataRelations<EntryType> | undefined,
): Set<string> {
  const nodes = new Map<string, NodeKind>()
  const referenced = new Set<string>()

  function add(node: ParsedNode, kind: NodeKind): void {
    if (nodes.has(node.key)) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata object keys must be unique throughout the graph',
      )
    }
    nodes.set(node.key, kind)
  }

  if (objects?.entry) {
    add(objects.entry, { object: 'entry', type: root })
  }
  for (const type of entryTypes) {
    for (const node of objects?.relatedEntries?.[type] ?? []) {
      add(node, { object: 'entry', type })
    }
  }

  for (const [slot, type] of Object.entries(metadataPartKinds[root])) {
    for (const node of objects?.parts?.[slot] ?? []) {
      add(node, { object: 'part', type })
    }
  }

  for (const node of objects?.tags ?? []) {
    add(node, { object: 'tag', type: 'tag' })
  }

  function requireNode(
    key: string,
    object: NodeKind['object'],
    types?: readonly NodeKind['type'][],
  ): NodeKind {
    const node = nodes.get(key)
    if (!node || node.object !== object || (types && !types.includes(node.type))) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata relation endpoint is missing or has an incompatible kind',
      )
    }
    referenced.add(key)
    return node
  }

  function requireWork(key: string): WorkType {
    const type = requireNode(key, 'entry').type
    if (!(entryTypes as readonly string[]).includes(type) || !isWorkType(type as EntryType)) {
      throw new DesktopError('InvalidInput', 'Metadata relation requires a work endpoint')
    }

    return type as WorkType
  }

  function requireRoot(key: string): void {
    if (key !== objects?.entry?.key) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata relation must remain in its declared root context',
      )
    }
  }

  for (const [relation, members] of Object.entries(relations ?? {})) {
    const businessKeys: string[] = []
    for (const raw of members) {
      switch (relation as keyof MetadataRelationMembers) {
        case 'workCharacters': {
          const member = raw as MetadataRelationMembers['workCharacters']
          requireWork(member.work)
          requireNode(member.character, 'entry', ['character'])
          requireRoot(isWorkType(root) ? member.work : member.character)
          businessKeys.push(JSON.stringify([member.work, member.character]))
          break
        }

        case 'personWorks': {
          const member = raw as MetadataRelationMembers['personWorks']
          const type = requireWork(member.work)
          requireNode(member.person, 'entry', ['person'])
          if (member.character !== null) {
            requireNode(member.character, 'entry', ['character'])
          }
          if (!canUsePersonRole(member.role, type, member.character !== null)) {
            throw new DesktopError(
              'InvalidInput',
              'Metadata person responsibility is incompatible with its work or character',
            )
          }

          let rootMember = member.character ?? ''
          if (isWorkType(root)) {
            rootMember = member.work
          } else if (root === 'person') {
            rootMember = member.person
          }
          requireRoot(rootMember)
          businessKeys.push(
            JSON.stringify([member.work, member.person, member.role, member.character]),
          )
          break
        }

        case 'organizationWorks': {
          const member = raw as MetadataRelationMembers['organizationWorks']
          const type = requireWork(member.work)
          requireNode(member.organization, 'entry', ['organization'])
          if (!canUseOrganizationRole(member.role, type)) {
            throw new DesktopError(
              'InvalidInput',
              'Metadata organization responsibility is incompatible with its work',
            )
          }
          requireRoot(isWorkType(root) ? member.work : member.organization)
          businessKeys.push(JSON.stringify([member.work, member.organization, member.role]))
          break
        }

        case 'workRelations': {
          const member = raw as MetadataRelationMembers['workRelations']
          const fromType = requireWork(member.from)
          const toType = requireWork(member.to)
          if (member.from !== objects?.entry?.key && member.to !== objects?.entry?.key) {
            throw new DesktopError(
              'InvalidInput',
              'Related works must connect to the metadata root',
            )
          }

          const normalized = normalizeWorkRelation({
            from: { type: fromType, id: member.from },
            to: { type: toType, id: member.to },
            type: member.type,
          })
          businessKeys.push(JSON.stringify([normalized.from.id, normalized.to.id, normalized.type]))
          break
        }

        case 'workVolumes': {
          const member = raw as MetadataRelationMembers['workVolumes']
          const type = requireWork(member.work)
          requireRoot(member.work)
          requireNode(member.volume, 'part', [type === 'comic' ? 'comicVolume' : 'novelVolume'])
          businessKeys.push(JSON.stringify([member.work, member.volume]))
          break
        }

        case 'workChapters': {
          const member = raw as MetadataRelationMembers['workChapters']
          requireNode(member.work, 'entry', ['comic'])
          requireRoot(member.work)
          requireNode(member.chapter, 'part', ['comicChapter'])
          businessKeys.push(JSON.stringify([member.work, member.chapter]))
          break
        }

        case 'workEpisodes': {
          const member = raw as MetadataRelationMembers['workEpisodes']
          requireNode(member.work, 'entry', ['anime'])
          requireRoot(member.work)
          requireNode(member.episode, 'part', ['animeEpisode'])
          businessKeys.push(JSON.stringify([member.work, member.episode]))
          break
        }

        case 'workExtras': {
          const member = raw as MetadataRelationMembers['workExtras']
          requireNode(member.work, 'entry', ['anime'])
          requireRoot(member.work)
          requireNode(member.extra, 'part', ['animeExtra'])
          businessKeys.push(JSON.stringify([member.work, member.extra]))
          break
        }

        case 'volumeChapters': {
          const member = raw as MetadataRelationMembers['volumeChapters']
          requireNode(member.volume, 'part', ['comicVolume'])
          requireNode(member.chapter, 'part', ['comicChapter'])
          businessKeys.push(JSON.stringify([member.volume, member.chapter]))
          break
        }

        case 'entryTags': {
          const member = raw as MetadataRelationMembers['entryTags']
          requireNode(member.entry, 'entry')
          requireRoot(member.entry)
          requireNode(member.tag, 'tag')
          businessKeys.push(JSON.stringify([member.entry, member.tag]))
          break
        }
      }
    }

    if (!unique(businessKeys, (value) => value)) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata relationship arrays must not repeat a business fact',
      )
    }
  }

  return referenced
}

/** Parse a complete composed candidate; personal data, local references and write instructions have no accepted fields. */
export function parseMetadataCandidate(input: unknown): MetadataCandidate {
  const { entryType } = parseValue(
    v.looseObject({ entryType: v.picklist(entryTypes) }),
    input,
    'Invalid metadata candidate',
  )
  const hasParts = Object.keys(metadataPartKinds[entryType]).length > 0
  const value = parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      objects: objectsSchema(entryType, true),
      relations: v.exactOptional(relationSchemas(entryType)),
      partMatching: v.exactOptional(
        hasParts
          ? v.pipe(
              v.unknown(),
              v.transform((value) => parsePartMatchingRules(entryType, value)),
            )
          : v.never(),
      ),
    }),
    input,
    'Invalid composed metadata candidate',
  )
  validateGraph(entryType, value.objects, value.relations)

  return value as MetadataCandidate
}

/** Parse source field answers and key relationships. Supplying the actual request also rejects unrequested data expansion. */
export function parseMetadataReadResult<T extends EntryType>(
  root: T,
  input: unknown,
  request?: MetadataReadRequest<T>,
): MetadataReadResult<T>
export function parseMetadataReadResult(
  root: EntryType,
  input: unknown,
  request?: unknown,
): unknown {
  const value = parseValue(
    v.strictObject({
      objects: v.exactOptional(objectsSchema(root, false)),
      relations: v.exactOptional(relationSchemas(root)),
    }),
    input,
    'Invalid metadata read result',
  )
  const referenced = validateGraph(root, value.objects, value.relations)
  if (request) {
    validateRequestedFields(
      root,
      value.objects,
      value.relations,
      parseMetadataReadRequest(root, request),
      referenced,
    )
  }

  return value as MetadataReadResult
}

function validateRequestedFields(
  root: EntryType,
  objects: ParsedObjects | undefined,
  relations: MetadataRelations<EntryType> | undefined,
  request: MetadataReadRequest,
  referenced: ReadonlySet<string>,
): void {
  function fields(
    node: ParsedNode,
    wanted:
      | { readonly fields: readonly string[]; readonly refs?: readonly ExternalIdentity[] }
      | undefined,
    identification: readonly string[],
    root = false,
  ): void {
    if (!root && !wanted && !referenced.has(node.key)) {
      throw new DesktopError('InvalidInput', 'Provider returned an unrequested metadata object')
    }

    const identities = [
      ...(node.identity ? [node.identity] : []),
      ...(node.externalIdentities ?? []),
    ].map(identityKey)
    const inRefs = !wanted?.refs || wanted.refs.some((ref) => identities.includes(identityKey(ref)))
    const allowed = new Set([
      'key',
      'identity',
      'externalIdentities',
      ...identification,
      ...(inRefs ? (wanted?.fields ?? []) : []),
    ])
    if (Object.keys(node).some((key) => !allowed.has(key))) {
      throw new DesktopError(
        'InvalidInput',
        'Provider returned fields outside the requested object scope',
      )
    }
  }

  if (objects?.entry) {
    fields(objects.entry, request.objects?.entry, Object.keys(identificationEntries(root)), true)
  }
  for (const type of entryTypes) {
    for (const node of objects?.relatedEntries?.[type] ?? []) {
      fields(
        node,
        request.objects?.relatedEntries?.[type],
        Object.keys(identificationEntries(type)),
      )
    }
  }

  const partRequests =
    request.objects && 'parts' in request.objects ? request.objects.parts : undefined
  for (const [slot, type] of Object.entries(metadataPartKinds[root])) {
    for (const node of objects?.parts?.[slot] ?? []) {
      fields(
        node,
        partRequests?.[slot as keyof typeof partRequests],
        Object.keys(partIdentificationEntries(type)),
      )
    }
  }

  for (const node of objects?.tags ?? []) {
    fields(node, request.objects?.tags, ['name'])
  }

  for (const [relation, members] of Object.entries(relations ?? {})) {
    const wanted = request.relations?.[relation as keyof typeof request.relations] as
      { readonly fields: readonly string[] } | undefined
    if (!wanted) {
      throw new DesktopError(
        'InvalidInput',
        'Provider returned unrequested relationship membership',
      )
    }

    const attributes = Object.keys(
      metadataRelationAttributeEntries[relation as keyof MetadataRelationMembers],
    )
    for (const member of members) {
      if (
        attributes.some(
          (attribute) => Object.hasOwn(member, attribute) && !wanted.fields.includes(attribute),
        )
      ) {
        throw new DesktopError(
          'InvalidInput',
          'Provider returned unrequested relationship attributes',
        )
      }
    }
  }
}

/** Interpret a work relation from the metadata root when comparing a declared scope; no second mirror fact is created. */
export function metadataRelationTypeFromRoot(
  rootKey: string,
  relation: MetadataRelationMembers['workRelations'],
): WorkRelationType {
  if (relation.from === rootKey) {
    return relation.type
  }
  if (relation.to === rootKey) {
    return reverseWorkRelationType(relation.type)
  }

  throw new DesktopError('InvalidInput', 'Work relation does not contain the metadata root')
}
