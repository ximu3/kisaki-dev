/** @fileoverview Parses finite metadata read requests without silently intersecting away unsupported requested fields. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import { nonemptyText, parseValue, unique } from '../validation'
import { entryTypes, identitiesSchema } from '../library/catalog'
import type { EntryType } from '../library/catalog'
import { getMetadataEntryFields, getMetadataPartFields } from './fields'
import { getMetadataRelations, metadataRelationFields } from './relations'
import type { MetadataRelationKey } from './relations'
import { metadataPartKinds } from './values'
import type { MetadataReadRequest } from './values'

function fields(names: readonly string[]) {
  return v.pipe(
    v.array(v.picklist(names)),
    v.check((values) => unique(values, (value) => value)),
  )
}

function objectRequest(names: readonly string[], withRefs: boolean) {
  return v.strictObject({
    fields: fields(names),
    refs: v.exactOptional(withRefs ? identitiesSchema : v.never()),
  })
}

/** Validate complete requested shape. Refs constrain object fields only and never reduce a separately requested relation. */
export function parseMetadataReadRequest<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataReadRequest<T>
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
      v.exactOptional(v.strictObject({ fields: fields(metadataRelationFields[relation]) })),
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
              fields: fields(['description', 'isNsfw']),
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

/** Check that every requested ordinary field and relation is supported; zero-field relation requests still require membership. */
export function requireMetadataRequestSupport<T extends EntryType>(
  root: T,
  requested: MetadataReadRequest<T>,
  supported: MetadataReadRequest<T>,
): void {
  const request = parseMetadataReadRequest(root, requested)
  const available = parseMetadataReadRequest(root, supported)

  interface RequestedFields {
    readonly fields: readonly PropertyKey[]
  }

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
