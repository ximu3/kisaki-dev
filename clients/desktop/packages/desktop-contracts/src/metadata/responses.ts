import { parseValue } from '../validation'
import * as v from 'valibot'
import {
  objectsSchema,
  metadataPartKinds,
  type ParsedObjects,
  type ParsedNode,
  type MetadataObjectIdentity,
  type MetadataPartKey,
  type MetadataPartType,
  type CandidateTag,
} from './objects'
import { relationSchemas, validateGraph } from './graph'
import { parseMetadataReadRequest, type MetadataReadRequest } from './requests'
import type { MetadataRelations, MetadataRelationMembers } from './relations'
import { DesktopError } from '../errors'
import {
  identityKey,
  entryTypes,
  type EntryType,
  type ExternalIdentity,
  type PartType,
} from '../library/catalog'
import { tagNameKey } from '../library/organizers'
import {
  identificationEntries,
  partIdentificationEntries,
  metadataRelationAttributeEntries,
  type MetadataEntryFields,
  type MetadataPartFields,
} from './fields'

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

  const tagRequest = request.objects?.tags
  const tagKeys = tagRequest?.names && new Set(tagRequest.names.map(tagNameKey))
  for (const node of objects?.tags ?? []) {
    const wanted = tagRequest && {
      fields: !tagKeys || tagKeys.has(tagNameKey(node.name)) ? tagRequest.fields : [],
    }
    fields(node, wanted, ['name'])
  }

  for (const [relation, members] of Object.entries(relations ?? {})) {
    const wanted = request.relations?.[relation as keyof typeof request.relations] as
      | { readonly fields: readonly string[] }
      | undefined
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

export type MetadataReadEntry<T extends EntryType> = MetadataObjectIdentity & MetadataEntryFields<T>

export type MetadataReadPart<T extends PartType> = MetadataObjectIdentity & MetadataPartFields<T>

export type MetadataReadRelatedEntries = {
  readonly [K in EntryType]?: readonly MetadataReadEntry<K>[]
}

export type MetadataReadParts<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly MetadataReadPart<MetadataPartType<T, K>>[]
}

export type MetadataReadResult<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly objects?: {
      readonly entry?: MetadataReadEntry<K>
      readonly relatedEntries?: MetadataReadRelatedEntries
      readonly tags?: readonly CandidateTag[]
    } & (K extends 'anime' | 'comic' | 'novel' ? { readonly parts?: MetadataReadParts<K> } : object)
    readonly relations?: MetadataRelations<K>
  }
}[T]
