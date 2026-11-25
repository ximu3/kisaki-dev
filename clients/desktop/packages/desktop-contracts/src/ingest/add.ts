import type { NonEmptyArray } from '../operations'
import { fromParser, parseValue, optionalFields, parseRecord, unique } from '../validation'
import * as v from 'valibot'
import {
  entryTypes,
  evaluationEntries,
  isWorkType,
  recordEntries,
  completionFieldsSchema,
  checkCompletionTotal,
  entryRefSchema,
  identitySchema,
  identityKey,
  type WorkType,
  type EntryType,
  type Evaluation,
  type WorkRecord,
  type CompletionFields,
  type EntryRef,
  type ExternalIdentity,
} from '../library/catalog'
import { DesktopError } from '../errors'
import {
  parseDirectoryCreateFields,
  type DirectoryDiscoveryDefinition,
} from '../library/holdings/directories'
import { parseAbsolutePath } from '../paths'
import { parseMetadataInput, type MetadataInput } from './metadata'
import { parseIngestIssue, type IngestIssue } from './issues'

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

  const local = fromParser((value) => {
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
  })
  const value = parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      metadata: fromParser((value) => parseMetadataInput(entryType, value)),
      initial: v.exactOptional(initial),
      localContent: v.exactOptional(isWorkType(entryType) ? local : v.never()),
    }),
    input,
    'Invalid complete add input',
  ) as IngestAddInput
  if (value.initial && 'record' in value.initial) {
    checkCompletionTotal(
      value.initial.record?.additionalCompletionCount ?? 0,
      value.initial.completionRecords?.length ?? 0,
    )
  }
  return value
}

export function parseIngestAddResult(input: unknown): IngestAddResult {
  const issues = v.array(fromParser(parseIngestIssue))
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
