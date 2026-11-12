/** @fileoverview Defines adoption update scopes, field policies and actual update outcomes. */

import type { EntryType, EntryRef, PartType, PartWorkType, PartRef } from '../library/catalog'
import { parseValue, parseRecord, unique } from '../validation'
import * as v from 'valibot'
import { characterRefSchema } from '../library/relations'
import {
  parseMetadataRelationScope,
  metadataRelationFields,
  getMetadataRelations,
} from '../metadata/relations'
import type {
  ScopedMetadataRelationKey,
  MetadataRelationScopeValues,
  PersonWorkScopeCondition,
  MetadataRelationAttributeValues,
  MetadataRelationKey,
} from '../metadata/relations'
import { DesktopError } from '../errors'
import type { NonEmptyArray } from '../operations'
import type { MetadataUpdateInput } from './metadata'
import type { MetadataEntryField, MetadataPartField } from '../metadata/fields'
import type { IngestIssue } from './issues'
import { entryRefSchema, partRefSchema, partTypes } from '../library/catalog'
import { partWorkType } from '../library/parts'
import { getMetadataPartFields, getMetadataEntryFields } from '../metadata/fields'
import { parseMetadataUpdateInput } from './metadata'
import { parseIngestIssue } from './issues'

function parsePersonAdoptionScope(root: EntryType, input: unknown): PersonAdoptionScope {
  if (input === 'all') {
    return 'all'
  }

  const conditions = parseValue(v.tupleWithRest([v.unknown()], v.unknown()), input)
  const result = conditions.map((condition) => {
    const original = parseRecord(condition)
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

export function relationSelection(root: EntryType, keys: readonly string[]) {
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

/** User scope is modification authority. Provider relationScopes separately determines where replacement is complete. */
export type PersonAdoptionScope =
  | 'all'
  | NonEmptyArray<
      | (PersonWorkScopeCondition & {
          readonly characters?: NonEmptyArray<EntryRef<'character'> | null>
        })
      | {
          readonly characters: NonEmptyArray<EntryRef<'character'> | null>
          readonly workTypes?: PersonWorkScopeCondition['workTypes']
          readonly roles?: PersonWorkScopeCondition['roles']
          readonly character?: 'none' | 'present'
        }
    >

export type IngestRelationScope<K extends keyof MetadataRelationScopeValues> =
  K extends 'personWorks' ? PersonAdoptionScope : MetadataRelationScopeValues[K]

export type FieldAdoption = 'fill' | 'overwrite'

/** update only touches already corresponding members. Ownership lists can only append real missing parts. */
export type IngestRelationUpdate<K extends keyof MetadataRelationAttributeValues> = K extends
  'workVolumes' | 'workChapters' | 'workEpisodes' | 'workExtras'
  ? {
      readonly mode: 'append'
    }
  : {
      readonly mode: 'update' | 'append' | 'replace'
      readonly fields?: { readonly [F in keyof MetadataRelationAttributeValues[K]]?: FieldAdoption }
      readonly scope?: K extends keyof MetadataRelationScopeValues ? IngestRelationScope<K> : never
    }

export type IngestEntryUpdate<T extends EntryType> = {
  readonly metadata: MetadataUpdateInput<T>
  readonly fields?: Readonly<Partial<Record<MetadataEntryField<T>, FieldAdoption>>>
  readonly relations?: { readonly [K in MetadataRelationKey<T>]?: IngestRelationUpdate<K> }
}

export type IngestPartUpdate<T extends PartType> = {
  readonly metadata: MetadataUpdateInput<PartWorkType<T>>
  readonly fields?: Readonly<Partial<Record<MetadataPartField<T>, FieldAdoption>>>
} & (T extends 'comicVolume'
  ? { readonly relations?: { readonly volumeChapters?: IngestRelationUpdate<'volumeChapters'> } }
  : object)

export type IngestUpdateType = EntryType | PartType

export type IngestUpdateRef<T extends IngestUpdateType> = T extends EntryType
  ? EntryRef<T>
  : T extends PartType
    ? PartRef<T>
    : never

export type IngestUpdateInput<T extends IngestUpdateType> = T extends EntryType
  ? IngestEntryUpdate<T>
  : T extends PartType
    ? IngestPartUpdate<T>
    : never

/** A batch fixes each real target before any fetch, and cannot adopt extra source objects as additional update targets. */
export type IngestUpdateItem = {
  [K in IngestUpdateType]: {
    readonly target: IngestUpdateRef<K>
    readonly input: IngestUpdateInput<K>
  }
}[IngestUpdateType]

export interface IngestUpdateResult {
  readonly outcome: 'updated' | 'unchanged'
  readonly target: EntryRef | PartRef
  readonly issues: readonly IngestIssue[]
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

/** updated may describe relationship-only or part-list changes; unchanged does not claim complete source data. */
export function parseIngestUpdateResult(input: unknown): IngestUpdateResult {
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

/** Only actual target references can become update inputs; no post-query selection token can expand the target set later. */
export function parseIngestUpdateTarget(input: unknown): EntryRef | PartRef {
  return parseValue(v.union([entryRefSchema, partRefSchema]), input, 'Invalid adoption target')
}
