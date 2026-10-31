/** @fileoverview Defines Entry query predicates, type applicability, intervals, groups, and fixed selections. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { parseLanguageTag } from '@kisaki3/extension-distribution/metadata'
import { monthDateSchema, type Bounds, type YearDate } from '../date'
import { invalidInput, type ErrorSummary } from '../errors'
import {
  hasUniqueKeys,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  nonnegativeNumberSchema,
  parseContract,
  safeIntegerSchema,
} from '../validation'
import {
  bloodTypes,
  genders,
  releaseStatuses,
  workStatuses,
  type BloodType,
  type Gender,
  type ReleaseStatus,
  type WorkStatus,
} from './catalog'
import {
  entryRefSchema,
  entryTypes,
  workRefSchema,
  workTypes,
  type EntryRef,
  type EntryType,
  type WorkRef,
  type WorkType,
} from './identity'
import {
  animeEpisodeTypes,
  animeExtraTypes,
  type AnimeEpisodeType,
  type AnimeExtraType,
} from './parts'
import {
  characterRefSchema,
  characterRoles,
  organizationRefSchema,
  organizationRoles,
  personRefSchema,
  personRoles,
  workRelationTypes,
  type CharacterRole,
  type OrganizationRole,
  type PersonRole,
  type WorkRelationType,
} from './relations'
import {
  boundsSchema,
  dateTestSchema,
  dateTestSchemas,
  entryGroupKeySchema,
  enumTestSchema,
  enumTestFields,
  presenceSchema,
  selectedValuesSchema,
  setTestSchema,
  textTestSchema,
  textTestFields,
  yearBoundsSchema,
  type EntryGroupKey,
  type Presence,
  type NumberTest,
  type SetTest,
  type EnumTest,
  type TextTest,
  type DateTest,
  type MonthDayTest,
} from './query-values'
import { entryFieldTypes } from './query-fields'

/** A fixed local entry scope; rule groups determine kinds and ordinary visibility always applies. */
export type EntryScope =
  | { readonly type: 'library' | 'favorites' | 'unclassified' }
  | { readonly type: 'collection' | 'tag' | 'note'; readonly id: string }

const partCountScopeSchema = v.union([
  objectSchema({
    partType: v.literal('animeEpisode'),
    classification: v.exactOptional(enumTestSchema(v.nullable(v.picklist(animeEpisodeTypes)))),
  }),
  objectSchema({
    partType: v.literal('animeExtra'),
    classification: v.exactOptional(enumTestSchema(v.nullable(v.picklist(animeExtraTypes)))),
  }),
  objectSchema({ partType: v.picklist(['comicVolume', 'comicChapter', 'novelVolume']) }),
])
/** Count actual parts in a kind and optional classification; no part is inferred from a declaration. */
export type PartCountScope =
  | {
      readonly partType: 'animeEpisode'
      readonly classification?: EnumTest<AnimeEpisodeType | null>
    }
  | { readonly partType: 'animeExtra'; readonly classification?: EnumTest<AnimeExtraType | null> }
  | { readonly partType: 'comicVolume' | 'comicChapter' | 'novelVolume' }
export const partCountMeasures = ['registered', 'completed', 'withFiles', 'accessible'] as const
export type PartCountMeasure = (typeof partCountMeasures)[number]

const boolFields = [
  'favorite',
  'isNsfw',
  'hasNotes',
  'hasPrimaryImage',
  'hasBackdrop',
  'hasTitleLogo',
  'hasIcon',
] as const
const presenceFields = [
  'originalName',
  'sortName',
  'description',
  'aliases',
  'externalLinks',
  'addedDate',
] as const
const countFields = [
  'additionalDurationMs',
  'totalDurationMs',
  'completionCount',
  'registeredFileCount',
  'accessibleFileCount',
  'uncheckedFileCount',
] as const
const declaredFields = [
  'declaredDurationMs',
  'declaredRegularEpisodeCount',
  'declaredSpecialEpisodeCount',
  'declaredPageCount',
  'declaredVolumeCount',
  'declaredChapterCount',
] as const
const measurementFields = ['age', 'height', 'weight', 'bust', 'waist', 'hips'] as const
const dateFields = [
  'effectiveAddedDate',
  'releaseDate',
  'releaseEndDate',
  'birthDate',
  'deathDate',
  'foundedDate',
  'dissolvedDate',
  'firstCompletedDate',
  'lastCompletedDate',
] as const
const nullableDateFields = [
  'releaseDate',
  'releaseEndDate',
  'birthDate',
  'deathDate',
  'foundedDate',
  'dissolvedDate',
  'firstCompletedDate',
  'lastCompletedDate',
] as const
const timeFields = ['createdAt', 'updatedAt', 'lastActiveAt'] as const
const languageSchema = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parseLanguageTag(value)
      return true
    } catch {
      return false
    }
  }),
  v.transform((value) => parseLanguageTag(value)),
)
const noteTest = v.union([textTestSchema, presenceSchema])
const characterFilterSchema = v.union([
  objectSchema({ type: v.picklist(['none', 'any']) }),
  objectSchema({ type: v.literal('oneOf'), refs: selectedValuesSchema(characterRefSchema) }),
])
const characterRoleSelection = selectedValuesSchema(v.nullable(v.picklist(characterRoles)))
const personRoleSelection = selectedValuesSchema(v.picklist(personRoles))
const organizationRoleSelection = selectedValuesSchema(v.picklist(organizationRoles))
const workTypeSelection = selectedValuesSchema(v.picklist(workTypes))
const workSelection = selectedValuesSchema(workRefSchema)
const qualifierNote = { note: v.exactOptional(noteTest) }
const personQualifier = {
  personRoles: v.exactOptional(personRoleSelection),
  character: v.exactOptional(characterFilterSchema),
  characterRoles: v.exactOptional(characterRoleSelection),
  ...qualifierNote,
}
const relationConditions = [
  relationCondition('workCharacters', characterRefSchema, {
    characterRoles: v.exactOptional(characterRoleSelection),
    ...qualifierNote,
  }),
  relationCondition('workPersons', personRefSchema, personQualifier),
  relationCondition('workCharacterPersons', personRefSchema, personQualifier),
  relationCondition('workOrganizations', organizationRefSchema, {
    organizationRoles: v.exactOptional(organizationRoleSelection),
    ...qualifierNote,
  }),
  relationCondition('relatedWorks', workRefSchema, {
    workTypes: v.exactOptional(workTypeSelection),
    relationTypes: v.exactOptional(selectedValuesSchema(v.picklist(workRelationTypes))),
    ...qualifierNote,
  }),
  relationCondition('characterWorks', workRefSchema, {
    workTypes: v.exactOptional(workTypeSelection),
    characterRoles: v.exactOptional(characterRoleSelection),
    ...qualifierNote,
  }),
  relationCondition('characterPersons', personRefSchema, {
    works: v.exactOptional(workSelection),
    workTypes: v.exactOptional(workTypeSelection),
    personRoles: v.exactOptional(personRoleSelection),
    ...qualifierNote,
  }),
  relationCondition('personWorks', workRefSchema, {
    workTypes: v.exactOptional(workTypeSelection),
    ...personQualifier,
  }),
  relationCondition('personCharacters', characterRefSchema, {
    works: v.exactOptional(workSelection),
    workTypes: v.exactOptional(workTypeSelection),
    personRoles: v.exactOptional(personRoleSelection),
    characterRoles: v.exactOptional(characterRoleSelection),
    ...qualifierNote,
  }),
  relationCondition('organizationWorks', workRefSchema, {
    workTypes: v.exactOptional(workTypeSelection),
    organizationRoles: v.exactOptional(organizationRoleSelection),
    ...qualifierNote,
  }),
] as const

export const entryConditionSchema: v.GenericSchema<unknown, EntryCondition> = v.union([
  objectSchema({ field: v.picklist(boolFields), op: v.literal('is'), value: v.boolean() }),
  presenceCondition(presenceFields),
  rangeCondition(['rating'], v.pipe(nonnegativeIntegerSchema, v.maxValue(100))),
  presenceCondition(['rating']),
  ...setConditions(['tags', 'manualCollections', 'sources'], nonemptyStringSchema),
  ...setConditions(['originalLanguages'], languageSchema),
  objectSchema({
    field: v.literal('status'),
    ...enumTestFields(v.nullable(v.picklist(workStatuses))),
  }),
  objectSchema({
    field: v.literal('releaseStatus'),
    ...enumTestFields(v.nullable(v.picklist(releaseStatuses))),
  }),
  objectSchema({ field: v.literal('gender'), ...enumTestFields(v.nullable(v.picklist(genders))) }),
  objectSchema({
    field: v.literal('bloodType'),
    ...enumTestFields(v.nullable(v.picklist(bloodTypes))),
  }),
  rangeCondition(countFields, nonnegativeIntegerSchema),
  rangeCondition(declaredFields, nonnegativeIntegerSchema),
  presenceCondition(declaredFields),
  rangeCondition(measurementFields, nonnegativeNumberSchema),
  presenceCondition(measurementFields),
  objectSchema({ field: v.picklist(measurementFields), ...textTestFields }),
  objectSchema({
    field: v.picklist(measurementFields),
    op: v.literal('kind'),
    value: v.picklist(['number', 'text']),
  }),
  objectSchema({ field: v.literal('cupSize'), ...textTestFields }),
  presenceCondition(['cupSize']),
  objectSchema({
    field: v.literal('parts'),
    scope: partCountScopeSchema,
    measure: v.picklist(partCountMeasures),
    op: v.literal('range'),
    bounds: boundsSchema(nonnegativeIntegerSchema),
  }),
  ...dateTestSchemas({ field: v.picklist(dateFields) }),
  presenceCondition(nullableDateFields),
  objectSchema({ field: v.literal('effectiveAddedDate'), op: v.literal('present') }),
  objectSchema({
    field: v.literal('birthDate'),
    op: v.literal('monthDayRange'),
    from: monthDateSchema,
    to: monthDateSchema,
  }),
  objectSchema({
    field: v.picklist(timeFields),
    op: v.literal('calendarRange'),
    bounds: yearBoundsSchema,
  }),
  v.pipe(
    objectSchema({
      field: v.picklist(timeFields),
      op: v.literal('instantRange'),
      from: v.exactOptional(safeIntegerSchema),
      to: v.exactOptional(safeIntegerSchema),
    }),
    v.check(
      (value) =>
        (value.from !== undefined || value.to !== undefined) &&
        (value.from === undefined || value.to === undefined || value.from < value.to),
    ),
  ),
  presenceCondition(['lastActiveAt']),
  objectSchema({
    field: v.literal('completions'),
    match: v.picklist(['exists', 'notExists']),
    where: objectSchema({
      completedDate: v.exactOptional(dateTestSchema),
      note: v.exactOptional(noteTest),
    }),
  }),
  ...relationConditions,
])

/** Explicit character qualification of the same person-work fact. */
export type CharacterCondition =
  | { readonly type: 'none' }
  | { readonly type: 'any' }
  | {
      readonly type: 'oneOf'
      readonly refs: readonly [EntryRef<'character'>, ...EntryRef<'character'>[]]
    }
interface NoteQualifier {
  readonly note?: TextTest | Presence
}
interface PersonQualifier extends NoteQualifier {
  readonly personRoles?: readonly [PersonRole, ...PersonRole[]]
  readonly character?: CharacterCondition
  readonly characterRoles?: readonly [CharacterRole | null, ...(CharacterRole | null)[]]
}
interface WorkQualifier {
  readonly workTypes?: readonly [WorkType, ...WorkType[]]
}
interface WorksQualifier extends WorkQualifier {
  readonly works?: readonly [WorkRef, ...WorkRef[]]
}
/** Closed relation fields keep target kinds and qualifiers associated with the actual fact. */
export type EntryRelationCondition =
  | {
      readonly field: 'workCharacters'
      readonly targets: SetTest<EntryRef<'character'>>
      readonly where?: NoteQualifier & {
        readonly characterRoles?: readonly [CharacterRole | null, ...(CharacterRole | null)[]]
      }
    }
  | {
      readonly field: 'workPersons' | 'workCharacterPersons'
      readonly targets: SetTest<EntryRef<'person'>>
      readonly where?: PersonQualifier
    }
  | {
      readonly field: 'workOrganizations'
      readonly targets: SetTest<EntryRef<'organization'>>
      readonly where?: NoteQualifier & {
        readonly organizationRoles?: readonly [OrganizationRole, ...OrganizationRole[]]
      }
    }
  | {
      readonly field: 'relatedWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: NoteQualifier &
        WorkQualifier & {
          readonly relationTypes?: readonly [WorkRelationType, ...WorkRelationType[]]
        }
    }
  | {
      readonly field: 'characterWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: NoteQualifier &
        WorkQualifier & {
          readonly characterRoles?: readonly [CharacterRole | null, ...(CharacterRole | null)[]]
        }
    }
  | {
      readonly field: 'characterPersons'
      readonly targets: SetTest<EntryRef<'person'>>
      readonly where?: NoteQualifier &
        WorksQualifier & { readonly personRoles?: readonly [PersonRole, ...PersonRole[]] }
    }
  | {
      readonly field: 'personWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: PersonQualifier & WorkQualifier
    }
  | {
      readonly field: 'personCharacters'
      readonly targets: SetTest<EntryRef<'character'>>
      readonly where?: Omit<PersonQualifier, 'character'> & WorksQualifier
    }
  | {
      readonly field: 'organizationWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: NoteQualifier &
        WorkQualifier & {
          readonly organizationRoles?: readonly [OrganizationRole, ...OrganizationRole[]]
        }
    }

/** Closed field/operand combinations; no arbitrary field names, paths, SQL, or nested query language. */
export type EntryCondition =
  | { readonly field: (typeof boolFields)[number]; readonly op: 'is'; readonly value: boolean }
  | ({
      readonly field:
        | (typeof presenceFields)[number]
        | 'rating'
        | (typeof declaredFields)[number]
        | (typeof measurementFields)[number]
        | 'cupSize'
        | 'lastActiveAt'
    } & Presence)
  | ({
      readonly field:
        | 'rating'
        | (typeof countFields)[number]
        | (typeof declaredFields)[number]
        | (typeof measurementFields)[number]
    } & NumberTest)
  | ({
      readonly field: 'tags' | 'manualCollections' | 'sources' | 'originalLanguages'
    } & SetTest<string>)
  | ({ readonly field: 'status' } & EnumTest<WorkStatus | null>)
  | ({ readonly field: 'releaseStatus' } & EnumTest<ReleaseStatus | null>)
  | ({ readonly field: 'gender' } & EnumTest<Gender | null>)
  | ({ readonly field: 'bloodType' } & EnumTest<BloodType | null>)
  | ({ readonly field: (typeof measurementFields)[number] | 'cupSize' } & TextTest)
  | {
      readonly field: (typeof measurementFields)[number]
      readonly op: 'kind'
      readonly value: 'number' | 'text'
    }
  | ({
      readonly field: 'parts'
      readonly scope: PartCountScope
      readonly measure: PartCountMeasure
    } & NumberTest)
  | ({ readonly field: (typeof nullableDateFields)[number] } & DateTest)
  | ({ readonly field: 'effectiveAddedDate' } & (
      Exclude<DateTest, Presence> | { readonly op: 'present' }
    ))
  | ({ readonly field: 'birthDate' } & MonthDayTest)
  | {
      readonly field: (typeof timeFields)[number]
      readonly op: 'calendarRange'
      readonly bounds: Bounds<YearDate>
    }
  | {
      readonly field: (typeof timeFields)[number]
      readonly op: 'instantRange'
      readonly from?: number
      readonly to?: number
    }
  | {
      readonly field: 'completions'
      readonly match: 'exists' | 'notExists'
      readonly where: { readonly completedDate?: DateTest; readonly note?: TextTest | Presence }
    }
  | EntryRelationCondition
/** All conditions must apply to every kind in the group, including when the group is disabled. */
export interface EntryRule {
  readonly enabled: boolean
  readonly types: readonly [EntryType, ...EntryType[]]
  readonly filter: { readonly match: 'all' | 'any'; readonly conditions: readonly EntryCondition[] }
}

/** The finite public sorting vocabulary; no booleans or internal enum encodings are sortable. */
export const entrySortFields = [
  'name',
  'originalName',
  'effectiveSortName',
  'rating',
  'effectiveAddedDate',
  'createdAt',
  'updatedAt',
  'releaseDate',
  'releaseEndDate',
  'additionalDurationMs',
  'totalDurationMs',
  'lastActiveAt',
  'completionCount',
  'firstCompletedDate',
  'lastCompletedDate',
  ...declaredFields,
  'birthDate',
  'birthMonthDay',
  'deathDate',
  'foundedDate',
  'dissolvedDate',
  ...measurementFields,
  'registeredFileCount',
  'accessibleFileCount',
  'uncheckedFileCount',
] as const
export type EntrySortField = (typeof entrySortFields)[number]
const entrySortSchema = v.union([
  objectSchema({ type: v.literal('scope') }),
  objectSchema({
    type: v.literal('field'),
    field: v.picklist(entrySortFields),
    direction: v.picklist(['asc', 'desc']),
  }),
  objectSchema({
    type: v.literal('parts'),
    scope: partCountScopeSchema,
    measure: v.picklist(partCountMeasures),
    direction: v.picklist(['asc', 'desc']),
  }),
])
export type EntrySort =
  | { readonly type: 'scope' }
  | { readonly type: 'field'; readonly field: EntrySortField; readonly direction: 'asc' | 'desc' }
  | {
      readonly type: 'parts'
      readonly scope: PartCountScope
      readonly measure: PartCountMeasure
      readonly direction: 'asc' | 'desc'
    }
/** Query identity excludes reading intervals and requested projection fields. No enabled groups means empty. */
export interface EntryQuery {
  readonly scope: EntryScope
  readonly search: string
  readonly rules: readonly EntryRule[]
  readonly sort: EntrySort
}

export const entryScopeSchema = v.union([
  objectSchema({ type: v.picklist(['library', 'favorites', 'unclassified']) }),
  objectSchema({ type: v.picklist(['collection', 'tag', 'note']), id: nonemptyStringSchema }),
])
const entryRuleSchema = objectSchema({
  enabled: v.boolean(),
  types: v.pipe(
    v.tupleWithRest([v.picklist(entryTypes)], v.picklist(entryTypes)),
    v.check((values) => new Set(values).size === values.length),
    v.readonly(),
  ),
  filter: objectSchema({
    match: v.picklist(['all', 'any']),
    conditions: v.pipe(v.array(entryConditionSchema), v.readonly()),
  }),
})
export const entryQuerySchema: v.GenericSchema<unknown, EntryQuery> = v.pipe(
  objectSchema({
    scope: entryScopeSchema,
    search: v.string(),
    rules: v.pipe(v.array(entryRuleSchema), v.readonly()),
    sort: entrySortSchema,
  }),
  v.check((query) => isQueryApplicable(query)),
)

/** A bad dynamic group remains visibly failed instead of masquerading as zero members. */
export type EntryGroupResult =
  | { readonly key: EntryGroupKey; readonly status: 'ready'; readonly count: number }
  | { readonly key: EntryGroupKey; readonly status: 'failed'; readonly error: ErrorSummary }
/** Group totals count distinct entries in the query, not the sum of repeated displayed memberships. */
export interface EntryGroupsResult {
  readonly total: number
  readonly groups: readonly EntryGroupResult[]
}
/** A stable selection request; expandedGroups is a set, never a replacement group display order. */
export type EntrySelection =
  | { readonly type: 'all' }
  | { readonly type: 'range'; readonly anchor: EntryRef; readonly focus: EntryRef }
  | {
      readonly type: 'groupRange'
      readonly anchor: { readonly group: EntryGroupKey; readonly ref: EntryRef }
      readonly focus: { readonly group: EntryGroupKey; readonly ref: EntryRef }
      readonly expandedGroups: readonly EntryGroupKey[]
    }

/** Validate every rule, its exact operands, and all enabled sort kinds without resolving live references. */
export function parseEntryQuery(input: unknown): EntryQuery {
  return parseContract(entryQuerySchema, input, 'entry query')
}
/** Validate one closed predicate; its owner still checks group kind applicability and live references. */
export function parseEntryCondition(input: unknown): EntryCondition {
  return parseContract(entryConditionSchema, input, 'entry condition')
}

/** Parse selection shape and explicit expanded group membership, without executing the query. */
export function parseEntrySelection(input: unknown): EntrySelection {
  const endpoint = objectSchema({ group: entryGroupKeySchema, ref: entryRefSchema })
  return parseContract(
    v.union([
      objectSchema({ type: v.literal('all') }),
      objectSchema({ type: v.literal('range'), anchor: entryRefSchema, focus: entryRefSchema }),
      v.pipe(
        objectSchema({
          type: v.literal('groupRange'),
          anchor: endpoint,
          focus: endpoint,
          expandedGroups: v.pipe(v.array(entryGroupKeySchema), v.readonly()),
        }),
        v.check((value) => {
          const keys = value.expandedGroups.map(groupKey)
          return (
            hasUniqueKeys(value.expandedGroups, groupKey) &&
            keys.includes(groupKey(value.anchor.group)) &&
            keys.includes(groupKey(value.focus.group))
          )
        }),
      ),
    ]),
    input,
    'entry selection',
  )
}

/** Compute the contract's centered interval for an existing index, without truncating invalid inputs. */
export function calculateLocateOffset(index: number, total: number, limit: number): number {
  parseContract(nonnegativeIntegerSchema, index, 'entry index')
  parseContract(nonnegativeIntegerSchema, total, 'entry total')
  parseContract(
    v.pipe(nonnegativeIntegerSchema, v.minValue(1), v.maxValue(200)),
    limit,
    'entry interval limit',
  )
  if (index >= total) {
    return invalidInput('The entry index is outside the result.')
  }
  return Math.max(0, Math.min(index - Math.floor(limit / 2), total - limit))
}

function isQueryApplicable(query: EntryQuery): boolean {
  for (const rule of query.rules) {
    for (const condition of rule.filter.conditions) {
      const allowed: readonly EntryType[] =
        condition.field === 'parts'
          ? [partWorkType(condition.scope)]
          : entryFieldTypes(condition.field)
      if (!rule.types.every((type) => allowed.includes(type))) {
        return false
      }
      if (
        'where' in condition &&
        condition.where &&
        'character' in condition.where &&
        condition.where.character?.type === 'none'
      ) {
        if (
          condition.field === 'workCharacterPersons' ||
          ('characterRoles' in condition.where && condition.where.characterRoles !== undefined)
        ) {
          return false
        }
      }
    }
  }
  const sort = query.sort
  if (sort.type === 'scope') {
    return true
  }
  const allowed: readonly EntryType[] =
    sort.type === 'parts' ? [partWorkType(sort.scope)] : entryFieldTypes(sort.field)
  return query.rules
    .filter((rule) => rule.enabled)
    .every((rule) => rule.types.every((type) => allowed.includes(type)))
}

function partWorkType(scope: PartCountScope): WorkType {
  if (scope.partType.startsWith('anime')) {
    return 'anime'
  }
  return scope.partType === 'novelVolume' ? 'novel' : 'comic'
}
function groupKey(group: EntryGroupKey): string {
  return group.type === 'unclassified' ? 'unclassified' : JSON.stringify(['collection', group.id])
}
function presenceCondition<const Fields extends readonly string[]>(fields: Fields) {
  return objectSchema({ field: v.picklist(fields), op: v.picklist(['present', 'absent']) })
}
function rangeCondition<
  const Fields extends readonly string[],
  Schema extends v.GenericSchema<number>,
>(fields: Fields, schema: Schema) {
  return objectSchema({
    field: v.picklist(fields),
    op: v.literal('range'),
    bounds: boundsSchema(schema),
  })
}
function setConditions<const Fields extends readonly string[], Schema extends v.GenericSchema>(
  fields: Fields,
  schema: Schema,
) {
  return [
    objectSchema({
      field: v.picklist(fields),
      op: v.picklist(['any', 'all', 'none']),
      values: selectedValuesSchema(schema),
    }),
    objectSchema({ field: v.picklist(fields), op: v.picklist(['empty', 'notEmpty']) }),
  ] as const
}
function relationCondition<
  const Field extends string,
  Schema extends v.GenericSchema,
  Entries extends v.ObjectEntries,
>(field: Field, target: Schema, where: Entries) {
  return objectSchema({
    field: v.literal(field),
    targets: setTestSchema(target),
    where: v.exactOptional(objectSchema(where)),
  })
}
