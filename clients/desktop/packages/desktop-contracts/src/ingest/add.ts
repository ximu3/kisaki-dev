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
import { parseValue, optionalFields, readRecord, unique } from '../validation'
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

/** A local candidate is one declared input. Only file-bearing directory inputs can explicitly select a recognition profile. */
export type IngestLocalContent<T extends WorkType> =
  | { readonly type: 'file'; readonly path: string }
  | ({ readonly type: 'directory'; readonly path: string } & (T extends 'game'
      ? object
      : {
          readonly definition?: DirectoryDiscoveryDefinition
          readonly recognitionProfileId?: string | null
        }))

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

export type AddResult<T extends EntryType = EntryType> =
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

/** Validate seven closed add branches and explicit work-only local content and personal initial values. */
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

      const { type: typeInput, ...fields } = readRecord(value)
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

/** An existing outcome needs actual nonempty complete identities; same-name suggestions never qualify as alreadyExists. */
export function parseAddResult(input: unknown): AddResult {
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
