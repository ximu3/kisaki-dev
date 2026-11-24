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
  type WorkRelationType,
} from '../library/relations'
import {
  getMetadataRelations,
  type MetadataRelations,
  type MetadataRelationMembers,
} from './relations'
import { DesktopError } from '../errors'
import {
  entryTypes,
  isWorkType,
  workTypes,
  type EntryType,
  type PartType,
  type WorkType,
} from '../library/catalog'
import { metadataPartKinds, type ParsedObjects, type ParsedNode } from './objects'

interface NodeKind {
  readonly object: 'entry' | 'part' | 'tag'
  readonly type: EntryType | PartType | 'tag'
}

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

function indexNodes(root: EntryType, objects: ParsedObjects | undefined) {
  const nodes = new Map<string, NodeKind>()

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

  return nodes
}

export function validateGraph(
  root: EntryType,
  objects: ParsedObjects | undefined,
  relations: MetadataRelations<EntryType> | undefined,
): Set<string> {
  const nodes = indexNodes(root, objects)
  const referenced = new Set<string>()

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
    const node = requireNode(key, 'entry')
    const type = workTypes.find((kind) => kind === node.type)
    if (!type) {
      throw new DesktopError('InvalidInput', 'Metadata relation requires a work endpoint')
    }

    return type
  }

  function requireRoot(key: string): void {
    if (key !== objects?.entry?.key) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata relation must remain in its declared root context',
      )
    }
  }

  if (!relations) {
    return referenced
  }

  const checkEndpoints: {
    [K in keyof MetadataRelationMembers]: (member: MetadataRelationMembers[K]) => string
  } = {
    workCharacters(member) {
      requireWork(member.work)
      requireNode(member.character, 'entry', ['character'])
      requireRoot(isWorkType(root) ? member.work : member.character)
      return JSON.stringify([member.work, member.character])
    },

    personWorks(member) {
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
      return JSON.stringify([member.work, member.person, member.role, member.character])
    },

    organizationWorks(member) {
      const type = requireWork(member.work)
      requireNode(member.organization, 'entry', ['organization'])
      if (!canUseOrganizationRole(member.role, type)) {
        throw new DesktopError(
          'InvalidInput',
          'Metadata organization responsibility is incompatible with its work',
        )
      }
      requireRoot(isWorkType(root) ? member.work : member.organization)
      return JSON.stringify([member.work, member.organization, member.role])
    },

    workRelations(member) {
      const fromType = requireWork(member.from)
      const toType = requireWork(member.to)
      if (member.from !== objects?.entry?.key && member.to !== objects?.entry?.key) {
        throw new DesktopError('InvalidInput', 'Related works must connect to the metadata root')
      }

      const binding = {
        from: { type: fromType, id: member.from },
        to: { type: toType, id: member.to },
        type: member.type,
      }
      validateWorkRelation(binding)
      const normalized = canonicalWorkRelation(binding)
      return JSON.stringify([normalized.from.id, normalized.to.id, normalized.type])
    },

    workVolumes(member) {
      const type = requireWork(member.work)
      requireRoot(member.work)
      requireNode(member.volume, 'part', [type === 'comic' ? 'comicVolume' : 'novelVolume'])
      return JSON.stringify([member.work, member.volume])
    },

    workChapters(member) {
      requireNode(member.work, 'entry', ['comic'])
      requireRoot(member.work)
      requireNode(member.chapter, 'part', ['comicChapter'])
      return JSON.stringify([member.work, member.chapter])
    },

    workEpisodes(member) {
      requireNode(member.work, 'entry', ['anime'])
      requireRoot(member.work)
      requireNode(member.episode, 'part', ['animeEpisode'])
      return JSON.stringify([member.work, member.episode])
    },

    workExtras(member) {
      requireNode(member.work, 'entry', ['anime'])
      requireRoot(member.work)
      requireNode(member.extra, 'part', ['animeExtra'])
      return JSON.stringify([member.work, member.extra])
    },

    volumeChapters(member) {
      requireNode(member.volume, 'part', ['comicVolume'])
      requireNode(member.chapter, 'part', ['comicChapter'])
      return JSON.stringify([member.volume, member.chapter])
    },

    entryTags(member) {
      requireNode(member.entry, 'entry')
      requireRoot(member.entry)
      requireNode(member.tag, 'tag')
      return JSON.stringify([member.entry, member.tag])
    },
  }

  function checkGroup<K extends keyof MetadataRelationMembers>(
    relation: K,
    members: readonly MetadataRelationMembers[K][],
  ) {
    const businessKeys = members.map(checkEndpoints[relation])
    if (!unique(businessKeys, (value) => value)) {
      throw new DesktopError(
        'InvalidInput',
        'Each relationship may appear only once in its metadata array',
      )
    }
  }

  for (const relation of Object.keys(relations) as (keyof MetadataRelationMembers)[]) {
    checkGroup(relation, relations[relation]!)
  }

  return referenced
}

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
