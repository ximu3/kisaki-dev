/** @fileoverview Exposes complete adoption contracts and pure intent/result validation, leaving actual writes to the desktop owner. */

import * as v from 'valibot'
import { DesktopError, parseExecutionFailure } from './errors'
import type { CallOptions, ExecutionContext } from './operations'
import { parseAbsolutePath } from './paths'
import {
  id,
  nonnegativeInteger,
  optionalFields,
  parseValue,
  readRecord,
  unique,
} from './validation'
import {
  completionFieldsSchema,
  entryRefSchema,
  entryTypes,
  evaluationEntries,
  identityKey,
  identitySchema,
  isWorkType,
  partRefSchema,
  partTypes,
  recordEntries,
} from './library/catalog'
import type { EntryRef, EntryType, PartRef, PartType } from './library/catalog'
import { parseDirectoryCreateFields } from './library/holdings'
import { partWorkType } from './library/parts'
import {
  getMetadataEntryFields,
  getMetadataPartFields,
  parseIdentificationClues,
} from './metadata/fields'
import { parseMetadataCandidate } from './metadata/graph'
import {
  getMetadataRelations,
  metadataRelationFields,
  parseMetadataRelationScope,
  parseMetadataRelationScopes,
} from './metadata/relations'
import type { MetadataRelationScopeValues, ScopedMetadataRelationKey } from './metadata/relations'
import { characterRefSchema } from './library/relations'
import { parseIngestIssue } from './ingest/issues'
import type {
  AddResult,
  IngestAddInput,
  IngestBatchResult,
  IngestEntryUpdate,
  IngestPartUpdate,
  IngestUpdateInput,
  IngestUpdateItem,
  IngestUpdateRef,
  IngestUpdateType,
  MetadataInput,
  MetadataUpdateInput,
  PersonAdoptionScope,
  UpdateResult,
} from './ingest/values'

export type * from './ingest/values'
export type { IngestIssue, IngestRelationRef } from './ingest/issues'
export { parseIngestIssue, parseIngestRelationRef } from './ingest/issues'

/** Each operation waits for its actual end, including graph commit and applicable initial local-content verification. */
export interface IngestApi {
  add<T extends EntryType>(input: IngestAddInput<T>, call?: CallOptions): Promise<AddResult<T>>
  addMany(
    inputs: readonly IngestAddInput[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<AddResult>>
  update(
    ...args: {
      [K in IngestUpdateType]: [
        target: IngestUpdateRef<K>,
        input: IngestUpdateInput<K>,
        call?: CallOptions,
      ]
    }[IngestUpdateType]
  ): Promise<UpdateResult>
  updateMany(
    inputs: readonly IngestUpdateItem[],
    call?: CallOptions,
  ): Promise<IngestBatchResult<UpdateResult>>
}
/** Native scanner/batch collaboration reuses the same complete business work inside an already admitted execution, without nested tasks. */
export interface IngestExecutor {
  add(input: IngestAddInput, context: ExecutionContext): Promise<AddResult>
  update(input: IngestUpdateItem, context: ExecutionContext): Promise<UpdateResult>
}

/** Parse a profile/prepared input in the actual root context. Prepared data is a candidate, never a local graph patch. */
export function parseMetadataInput<T extends EntryType>(root: T, input: unknown): MetadataInput<T> {
  return parseMetadataSource(root, input, false) as MetadataInput<T>
}
/** Update can derive omitted profile clues from the fixed local target; prepared data still has a complete candidate root. */
export function parseMetadataUpdateInput<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataUpdateInput<T> {
  return parseMetadataSource(root, input, true) as MetadataUpdateInput<T>
}
function parseMetadataSource(
  root: EntryType,
  input: unknown,
  update: boolean,
): MetadataInput<EntryType> | MetadataUpdateInput<EntryType> {
  const clues = v.pipe(
    v.unknown(),
    v.transform((value) => parseIdentificationClues(root, value)),
  )
  const data = v.pipe(
    v.unknown(),
    v.transform(parseMetadataCandidate),
    v.check((value) => value.entryType === root),
  )
  return parseValue(
    v.variant('type', [
      v.strictObject({
        type: v.literal('profile'),
        profileId: id,
        clues: update ? v.exactOptional(clues) : clues,
      }),
      v.strictObject({
        type: v.literal('prepared'),
        data,
        relationScopes: v.exactOptional(
          v.pipe(
            v.unknown(),
            v.transform((value) => parseMetadataRelationScopes(root, value)),
          ),
        ),
      }),
    ]),
    input,
    'Invalid metadata adoption source',
  )
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

function parsePersonAdoptionScope(root: EntryType, input: unknown): PersonAdoptionScope {
  if (input === 'all') {
    return 'all'
  }
  const conditions = parseValue(v.tupleWithRest([v.unknown()], v.unknown()), input)
  const result = conditions.map((condition) => {
    const original = readRecord(condition)
    const { characters, ...base } = original
    const selected = Object.hasOwn(original, 'characters')
      ? parseValue(
          v.pipe(
            v.tupleWithRest([v.nullable(characterRefSchema)], v.nullable(characterRefSchema)),
            v.check((refs) =>
              unique(refs, (ref) =>
                ref === null ? 'null' : JSON.stringify(['character', ref.id]),
              ),
            ),
          ),
          characters,
        )
      : undefined
    const scope = parseMetadataRelationScope(
      root,
      'personWorks' as ScopedMetadataRelationKey<typeof root>,
      Object.keys(base).length === 0 && selected ? 'all' : [base],
    )
    if (
      selected &&
      ((root === 'character' && selected.includes(null)) ||
        (base.character === 'none' && selected.some((ref) => ref !== null)) ||
        (base.character === 'present' && selected.includes(null)))
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Character scope contradicts the selected relationship context',
      )
    }
    const fields = scope === 'all' ? {} : scope[0]
    return { ...fields, ...(selected ? { characters: selected } : {}) }
  })
  return [result[0]!, ...result.slice(1)] as PersonAdoptionScope
}

function relationSelection(root: EntryType, keys: readonly string[]) {
  const rules: Record<string, v.GenericSchema> = {}
  for (const key of keys) {
    if (['workVolumes', 'workChapters', 'workEpisodes', 'workExtras'].includes(key)) {
      rules[key] = v.exactOptional(v.strictObject({ mode: v.literal('append') }))
      continue
    }
    const relation = key as keyof MetadataRelationScopeValues
    const attrs = Object.fromEntries(
      metadataRelationFields[relation].map((field) => [
        field,
        v.exactOptional(v.picklist(['fill', 'overwrite'])),
      ]),
    )
    rules[key] = v.exactOptional(
      v.strictObject({
        mode: v.picklist(['update', 'append', 'replace']),
        fields: v.exactOptional(v.strictObject(attrs)),
        scope: v.exactOptional(
          v.pipe(
            v.unknown(),
            v.transform((value) =>
              relation === 'personWorks'
                ? parsePersonAdoptionScope(root, value)
                : parseMetadataRelationScope(
                    root,
                    relation as ScopedMetadataRelationKey<typeof root>,
                    value,
                  ),
            ),
          ),
        ),
      }),
    )
  }
  return v.strictObject(rules)
}

/** Validate an explicit fixed Entry/Part target and its own field/relationship choices; no generic expected or adoption wrapper exists. */
export function parseIngestUpdateItem(input: unknown): IngestUpdateItem {
  const header = parseValue(
    v.looseObject({ target: v.union([entryRefSchema, partRefSchema]) }),
    input,
  )
  const target = header.target
  const part = (partTypes as readonly string[]).includes(target.type)
  const root = part ? partWorkType(target.type as PartType) : (target.type as EntryType)
  const fieldNames = part
    ? getMetadataPartFields(target.type as PartType)
    : getMetadataEntryFields(root)
  const fields = v.strictObject(
    Object.fromEntries(
      fieldNames.map((field) => [field, v.exactOptional(v.picklist(['fill', 'overwrite']))]),
    ),
  )
  let relations: v.GenericSchema = v.never()
  if (!part) {
    relations = relationSelection(root, getMetadataRelations(root))
  } else if (target.type === 'comicVolume') {
    relations = relationSelection(root, ['volumeChapters'])
  }
  return parseValue(
    v.strictObject({
      target: v.union([entryRefSchema, partRefSchema]),
      input: v.strictObject({
        metadata: v.pipe(
          v.unknown(),
          v.transform((value) => parseMetadataUpdateInput(root, value)),
        ),
        fields: v.exactOptional(fields),
        relations: v.exactOptional(relations),
      }),
    }),
    input,
    'Invalid complete update input',
  ) as IngestUpdateItem
}

/** Empty field choices and update-only relations without attributes require no fetch and cannot adopt identities. */
export function hasIngestUpdateWork(
  input: IngestEntryUpdate<EntryType> | IngestPartUpdate<PartType>,
): boolean {
  if (Object.keys(input.fields ?? {}).length > 0) {
    return true
  }
  if (!('relations' in input)) {
    return false
  }
  return Object.values(input.relations ?? {}).some(
    (rule) =>
      rule !== undefined &&
      (rule.mode !== 'update' || ('fields' in rule && Object.keys(rule.fields ?? {}).length > 0)),
  )
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
/** updated may describe relationship-only or part-list changes; unchanged does not claim complete source data. */
export function parseUpdateResult(input: unknown): UpdateResult {
  return parseValue(
    v.strictObject({
      outcome: v.picklist(['updated', 'unchanged']),
      target: v.union([entryRefSchema, partRefSchema]),
      issues: v.array(v.pipe(v.unknown(), v.transform(parseIngestIssue))),
    }),
    input,
    'Invalid update result',
  )
}

/** Validate complete or partial batch reporting without manufacturing failed items for work that did not start. */
export function parseIngestBatchResult<Result>(
  input: unknown,
  parseResult: (value: unknown) => Result,
  completeness: 'complete' | 'partial' = 'complete',
): IngestBatchResult<Result> {
  const result = v.pipe(v.unknown(), v.transform(parseResult))
  const failure = v.pipe(
    v.unknown(),
    v.transform((value) => parseExecutionFailure(value, parseResult)),
  )
  const value = parseValue(
    v.strictObject({
      total: nonnegativeInteger,
      items: v.array(
        v.union([
          v.strictObject({ index: nonnegativeInteger, result }),
          v.strictObject({ index: nonnegativeInteger, error: failure }),
        ]),
      ),
    }),
    input,
    'Invalid adoption batch result',
  )
  if (
    !unique(value.items, (item) => String(item.index)) ||
    value.items.some((item) => item.index >= value.total) ||
    (completeness === 'complete' && value.items.length !== value.total)
  ) {
    throw new DesktopError('InvalidInput', 'Adoption batch report has inconsistent input indices')
  }
  return value
}

/** Only actual target references can become update inputs; no post-query selection token can expand the target set later. */
export function parseIngestUpdateTarget(input: unknown): EntryRef | PartRef {
  return parseValue(v.union([entryRefSchema, partRefSchema]), input, 'Invalid adoption target')
}
