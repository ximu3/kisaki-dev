/** @fileoverview Defines initial adoption intent and validates actual add outcomes. */

import type {
  WorkType,
  EntryType,
  Evaluation,
  WorkRecord,
  CompletionFields,
  EntryRef,
  ExternalIdentity,
} from '../library/catalog'
import type { DirectoryDiscoveryDefinition } from '../library/holdings/directories'
import type { MetadataInput } from './metadata'
import type { IngestIssue } from './issues'
import type { NonEmptyArray } from '../operations'
import { parseValue, optionalFields, parseRecord, unique } from '../validation'
import * as v from 'valibot'
import {
  entryTypes,
  evaluationEntries,
  isWorkType,
  recordEntries,
  completionFieldsSchema,
  entryRefSchema,
  identitySchema,
  identityKey,
} from '../library/catalog'
import { DesktopError } from '../errors'
import { parseDirectoryCreateFields } from '../library/holdings/directories'
import { parseAbsolutePath } from '../paths'
import { parseMetadataInput } from './metadata'
import { parseIngestIssue } from './issues'

/**
 * One explicit local file or directory candidate for a work addition.
 *
 * Only file-bearing work directories can select a recognition profile.
 */
export type IngestLocalContent<T extends WorkType> =
  | { readonly type: 'file'; readonly path: string }
  | ({ readonly type: 'directory'; readonly path: string } & (T extends 'game'
      ? object
      : {
          readonly definition?: DirectoryDiscoveryDefinition
          readonly recognitionProfileId?: string | null
        }))

/**
 * Metadata adoption intent for one new entry, with optional initial personal facts.
 *
 * Work branches additionally accept local content and usage or completion records.
 */
export type IngestAddInput<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly entryType: K
    readonly metadata: MetadataInput<K>
    readonly initial?: { readonly evaluation?: Partial<Evaluation> } & (K extends WorkType
      ? {
          readonly record?: Partial<WorkRecord>
          readonly completionRecords?: readonly CompletionFields[]
        }
      : object)
  } & (K extends WorkType ? { readonly localContent?: IngestLocalContent<K> } : object)
}[T]

/**
 * The created entry or an existing entry matched by complete external identities.
 *
 * Issues retain excluded branches or ancillary failures. Name-only similarity cannot produce
 * alreadyExists.
 */
export type IngestAddResult<T extends EntryType = EntryType> =
  | {
      readonly outcome: 'added'
      readonly entry: EntryRef<T>
      readonly issues: readonly IngestIssue[]
    }
  | {
      readonly outcome: 'alreadyExists'
      readonly entry: EntryRef<T>
      readonly matchedIdentities: NonEmptyArray<ExternalIdentity>
      readonly issues: readonly IngestIssue[]
    }

/**
 * Parses an addition with the metadata, local content and personal fields allowed for its entry
 * type.
 */
export function parseIngestAddInput(input: unknown): IngestAddInput {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  const initial = v.strictObject({
    evaluation: v.exactOptional(v.strictObject(optionalFields(evaluationEntries))),
    record: v.exactOptional(
      isWorkType(entryType) ? v.strictObject(optionalFields(recordEntries)) : v.never(),
    ),
    completionRecords: v.exactOptional(
      isWorkType(entryType) ? v.array(completionFieldsSchema) : v.never(),
    ),
  })

  const local = v.pipe(
    v.unknown(),
    v.transform((value) => {
      if (!isWorkType(entryType)) {
        throw new DesktopError('InvalidInput', 'Only works can register local content')
      }

      const { type: typeInput, ...fields } = parseRecord(value)
      const type = parseValue(v.picklist(['directory', 'file']), typeInput)
      return type === 'directory'
        ? { type, ...parseDirectoryCreateFields(entryType, fields) }
        : {
            type,
            ...parseValue(
              v.strictObject({ path: v.pipe(v.unknown(), v.transform(parseAbsolutePath)) }),
              fields,
            ),
          }
    }),
  )
  return parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      metadata: v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataInput(entryType, value)),
      ),
      initial: v.exactOptional(initial),
      localContent: v.exactOptional(isWorkType(entryType) ? local : v.never()),
    }),
    input,
    'Invalid complete add input',
  ) as IngestAddInput
}

/** Parses an addition outcome and requires distinct matched identities for alreadyExists. */
export function parseIngestAddResult(input: unknown): IngestAddResult {
  const issues = v.array(v.pipe(v.unknown(), v.transform(parseIngestIssue)))
  return parseValue(
    v.variant('outcome', [
      v.strictObject({ outcome: v.literal('added'), entry: entryRefSchema, issues }),
      v.strictObject({
        outcome: v.literal('alreadyExists'),
        entry: entryRefSchema,
        matchedIdentities: v.pipe(
          v.tupleWithRest([identitySchema], identitySchema),
          v.check((values) => unique(values, identityKey)),
        ),
        issues,
      }),
    ]),
    input,
    'Invalid add result',
  )
}
