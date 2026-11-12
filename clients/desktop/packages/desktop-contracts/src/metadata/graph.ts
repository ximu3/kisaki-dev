/** @fileoverview Checks shared metadata graph references, relation applicability and node consistency. */

import type { EntryType, PartType, WorkType } from '../library/catalog'
import * as v from 'valibot'
import { id, optionalFields, unique } from '../validation'
import { metadataRelationAttributeEntries } from './fields'
import {
  personRoles,
  organizationRoles,
  workRelationTypes,
  canUsePersonRole,
  canUseOrganizationRole,
  canonicalWorkRelation,
  validateWorkRelation,
  reverseWorkRelationType,
} from '../library/relations'
import { getMetadataRelations } from './relations'
import type { ParsedObjects, ParsedNode } from './objects'
import type { MetadataRelations, MetadataRelationMembers } from './relations'
import { DesktopError } from '../errors'
import { entryTypes, isWorkType } from '../library/catalog'
import { metadataPartKinds } from './objects'
import type { WorkRelationType } from '../library/relations'

/** Object family and concrete kind associated with a graph-local key. */
interface NodeKind {
  readonly object: 'entry' | 'part' | 'tag'
  readonly type: EntryType | PartType | 'tag'
}

/** Creates relation-array schemas permitted for the selected metadata root kind. */
export function relationSchemas(root: EntryType) {
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

/**
 * Checks unique nodes, typed endpoints, root context and relation business-key uniqueness.
 *
 * Returns the object keys referenced by valid relations.
 */
export function validateGraph(
  root: EntryType,
  objects: ParsedObjects | undefined,
  relations: MetadataRelations<EntryType> | undefined,
): Set<string> {
  const nodes = new Map<string, NodeKind>()
  const referenced = new Set<string>()

  /** Registers a graph node and rejects a key already used by another node. */
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

  /** Resolves a compatible endpoint and records that its key is referenced. */
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

  /** Resolves a work endpoint and returns its concrete medium. */
  function requireWork(key: string): WorkType {
    const type = requireNode(key, 'entry').type
    if (!(entryTypes as readonly string[]).includes(type) || !isWorkType(type as EntryType)) {
      throw new DesktopError('InvalidInput', 'Metadata relation requires a work endpoint')
    }

    return type as WorkType
  }

  /** Requires a relation endpoint to be the graph's declared root. */
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

          const binding = {
            from: { type: fromType, id: member.from },
            to: { type: toType, id: member.to },
            type: member.type,
          }
          validateWorkRelation(binding)
          const normalized = canonicalWorkRelation(binding)
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

/**
 * Returns a work relationship as viewed from the metadata root.
 *
 * Rejects a relation that does not contain that root.
 */
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
