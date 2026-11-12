/** @fileoverview Parses finite metadata read requests without silently intersecting away unsupported requested fields. */

import * as v from 'valibot'
import { unique, parseValue, nonemptyText } from '../validation'
import { identitiesSchema, entryTypes } from '../library/catalog'
import type { EntryType } from '../library/catalog'
import { fieldNamesSchema, getMetadataEntryFields, getMetadataPartFields } from './fields'
import { metadataPartKinds } from './objects'
import { getMetadataRelations, metadataRelationFields } from './relations'
import { DesktopError } from '../errors'
import type { MetadataRelationKey, MetadataRelationAttributeValues } from './relations'
import type { ObjectFieldRequest, MetadataPartKey, MetadataPartType } from './objects'
import type { MetadataEntryField, MetadataPartField } from './fields'

/**
 * Creates a field-request schema with source references enabled only for supported object groups.
 */
function objectRequest(names: readonly string[], withRefs: boolean) {
  return v.strictObject({
    fields: fieldNamesSchema(names),
    refs: v.exactOptional(withRefs ? identitiesSchema : v.never()),
  })
}

/**
 * Parses a read request for the selected root kind.
 *
 * Source references narrow object fields while independently requested relation memberships retain
 * their full scope.
 */
export function parseMetadataReadRequest<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataReadRequest<T>

/** Builds root-specific object and relation request schemas and validates the complete input. */
export function parseMetadataReadRequest(root: EntryType, input: unknown): MetadataReadRequest {
  const related = Object.fromEntries(
    entryTypes.map((type) => [
      type,
      v.exactOptional(objectRequest(getMetadataEntryFields(type), true)),
    ]),
  )

  const parts = Object.fromEntries(
    Object.entries(metadataPartKinds[root]).map(([slot, type]) => [
      slot,
      v.exactOptional(objectRequest(getMetadataPartFields(type), true)),
    ]),
  )

  const relations = Object.fromEntries(
    getMetadataRelations(root).map((relation) => [
      relation,
      v.exactOptional(
        v.strictObject({ fields: fieldNamesSchema(metadataRelationFields[relation]) }),
      ),
    ]),
  )
  return parseValue(
    v.strictObject({
      objects: v.exactOptional(
        v.strictObject({
          entry: v.exactOptional(objectRequest(getMetadataEntryFields(root), false)),
          relatedEntries: v.exactOptional(v.strictObject(related)),
          parts: v.exactOptional(Object.keys(parts).length > 0 ? v.strictObject(parts) : v.never()),
          tags: v.exactOptional(
            v.strictObject({
              fields: fieldNamesSchema(['description', 'isNsfw']),
              names: v.exactOptional(
                v.pipe(
                  v.array(nonemptyText),
                  v.check((names) => unique(names, (name) => name)),
                ),
              ),
            }),
          ),
        }),
      ),
      relations: v.exactOptional(v.strictObject(relations)),
    }),
    input,
    'Invalid metadata read request',
  ) as MetadataReadRequest
}

/**
 * Checks that every requested object group, relation and field is supported.
 *
 * A relation request with no attribute fields still requires membership support.
 */
export function requireMetadataRequestSupport<T extends EntryType>(
  root: T,
  requested: MetadataReadRequest<T>,
  supported: MetadataReadRequest<T>,
): void {
  const request = parseMetadataReadRequest(root, requested)
  const available = parseMetadataReadRequest(root, supported)

  /** Field-name projection used to compare a requested group with its supported capability. */
  interface RequestedFields {
    readonly fields: readonly PropertyKey[]
  }

  /** Requires a requested group and each of its fields to be present in the support declaration. */
  function objectFields(
    request: RequestedFields | undefined,
    support: RequestedFields | undefined,
  ): void {
    if (!request) {
      return
    }
    if (!support || request.fields.some((field) => !support.fields.includes(field))) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata request includes unsupported fields or membership',
      )
    }
  }

  objectFields(request.objects?.entry, available.objects?.entry)
  objectFields(request.objects?.tags, available.objects?.tags)
  for (const type of entryTypes) {
    objectFields(request.objects?.relatedEntries?.[type], available.objects?.relatedEntries?.[type])
  }

  const wantedParts:
    Partial<Record<'episode' | 'extra' | 'volume' | 'chapter', RequestedFields>> | undefined =
    request.objects && 'parts' in request.objects ? request.objects.parts : undefined
  const offeredParts: typeof wantedParts =
    available.objects && 'parts' in available.objects ? available.objects.parts : undefined
  for (const slot of ['episode', 'extra', 'volume', 'chapter'] as const) {
    objectFields(wantedParts?.[slot], offeredParts?.[slot])
  }

  const wantedRelations: Partial<Record<MetadataRelationKey, RequestedFields>> | undefined =
    request.relations
  const offeredRelations: typeof wantedRelations = available.relations
  for (const relation of getMetadataRelations(root)) {
    objectFields(wantedRelations?.[relation], offeredRelations?.[relation])
  }
}

/** Related-entry field and source-reference requests grouped by entry kind. */
export type MetadataRelatedEntryRequests = {
  readonly [K in EntryType]?: ObjectFieldRequest<MetadataEntryField<K>>
}

/** Part field and source-reference requests grouped by root-compatible slots. */
export type MetadataPartRequests<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: ObjectFieldRequest<MetadataPartField<MetadataPartType<T, K>>>
}

/**
 * Independent object-field and relation-membership selections for one source read.
 *
 * An empty fields array requests no ordinary attributes; a relation still requests its membership.
 * An explicit empty refs array selects no object fields.
 */
export type MetadataReadRequest<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly objects?: {
      readonly entry?: { readonly fields: readonly MetadataEntryField<K>[] }
      readonly relatedEntries?: MetadataRelatedEntryRequests
      readonly tags?: {
        readonly fields: readonly ('description' | 'isNsfw')[]
        readonly names?: readonly string[]
      }
    } & (K extends 'anime' | 'comic' | 'novel'
      ? { readonly parts?: MetadataPartRequests<K> }
      : object)
    readonly relations?: {
      readonly [R in MetadataRelationKey<K>]?: {
        readonly fields: readonly (keyof MetadataRelationAttributeValues[R])[]
      }
    }
  }
}[T]
