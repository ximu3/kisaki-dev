import { fromParser, parseValue, parseRecord, unique } from '../validation'
import * as v from 'valibot'
import { characterRefSchema } from '../library/relations'
import {
  parseMetadataRelationScope,
  metadataRelationFields,
  getMetadataRelations,
  type ScopedMetadataRelationKey,
  type MetadataRelationScopeValues,
  type PersonWorkScopeCondition,
  type MetadataRelationAttributeValues,
  type MetadataRelationKey,
} from '../metadata/relations'
import { DesktopError } from '../errors'
import type { NonEmptyArray } from '../operations'
import {
  entryRefSchema,
  partRefSchema,
  partTypes,
  type EntryType,
  type EntryRef,
  type PartType,
  type PartWorkType,
  type PartRef,
} from '../library/catalog'
import { partWorkType } from '../library/parts'
import {
  getMetadataPartFields,
  getMetadataEntryFields,
  type MetadataEntryField,
  type MetadataPartField,
} from '../metadata/fields'
import { parseMetadataUpdateInput, type MetadataUpdateInput } from './metadata'
import { parseIngestIssue, type IngestIssue } from './issues'

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

/**
 * Owned part lists permit append only; other relations expose their allowed attribute policies and
 * scopes.
 */
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
          fromParser((value) =>
            relation === 'personWorks'
              ? parsePersonAdoptionScope(root, value)
              : parseMetadataRelationScope(
                  root,
                  relation as ScopedMetadataRelationKey<typeof root>,
                  value,
                ),
          ),
        ),
      }),
    )
  }

  return v.strictObject(rules)
}

/**
 * The user's authorized person-work relation scope, including explicit local character selections.
 *
 * Provider relationScopes independently determines where replacement data is complete.
 */
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

/**
 * The authorized update scope for a relation, with local character selection for person-work links.
 */
export type IngestRelationScope<K extends keyof MetadataRelationScopeValues> =
  K extends 'personWorks' ? PersonAdoptionScope : MetadataRelationScopeValues[K]

/** A policy to fill an empty field or overwrite its existing value. */
export type FieldAdoption = 'fill' | 'overwrite'

/**
 * Update touches corresponding existing members. Owned part lists can only append missing parts.
 */
export type IngestRelationUpdate<K extends keyof MetadataRelationAttributeValues> = K extends
  | 'workVolumes'
  | 'workChapters'
  | 'workEpisodes'
  | 'workExtras'
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

/** Comic volumes may additionally adopt their chapter membership. */
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

/**
 * The target is fixed before acquisition; extra source objects do not become additional update
 * targets.
 */
export type IngestUpdateItem = {
  [K in IngestUpdateType]: {
    readonly target: IngestUpdateRef<K>
    readonly input: IngestUpdateInput<K>
  }
}[IngestUpdateType]

/**
 * Updated includes relation-only or part-list changes. Unchanged does not establish source
 * completeness.
 */
export interface IngestUpdateResult<T extends IngestUpdateType = IngestUpdateType> {
  readonly outcome: 'updated' | 'unchanged'
  readonly target: IngestUpdateRef<T>
  readonly issues: readonly IngestIssue[]
}

/** Parses a fixed entry or part target with its applicable field and relationship choices. */
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
        metadata: fromParser((value) => parseMetadataUpdateInput(root, value)),
        fields: v.exactOptional(fields),
        relations: v.exactOptional(relations),
      }),
    }),
    input,
    'Invalid complete update input',
  ) as IngestUpdateItem
}

/**
 * Empty field choices and update-only relations without attributes require no fetch and cannot
 * adopt identities.
 */
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

/** Parses an update outcome, its actual entry or part target and adoption issues. */
export function parseIngestUpdateResult(input: unknown): IngestUpdateResult {
  return parseValue(
    v.strictObject({
      outcome: v.picklist(['updated', 'unchanged']),
      target: v.union([entryRefSchema, partRefSchema]),
      issues: v.array(fromParser(parseIngestIssue)),
    }),
    input,
    'Invalid update result',
  )
}

export function parseIngestUpdateTarget(input: unknown): EntryRef | PartRef {
  return parseValue(v.union([entryRefSchema, partRefSchema]), input, 'Invalid adoption target')
}
