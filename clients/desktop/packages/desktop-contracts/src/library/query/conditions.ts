/** @fileoverview Defines and validates closed query conditions, qualifiers and rule groups. */

import type { Bounds, NonEmptyArray } from '../../operations'
import type { YearDate, MonthDate } from '../../date'
import type {
  AnimeEpisodeType,
  AnimeExtraType,
  EntryRef,
  WorkRef,
  LanguageTag,
  WorkStatus,
  ReleaseStatus,
  Gender,
  BloodType,
  EntryType,
} from '../catalog'
import type { CharacterRole, PersonRole, OrganizationRole, WorkRelationType } from '../relations'
import * as v from 'valibot'
import {
  nonemptyText,
  integer,
  timestamp,
  nonnegativeInteger,
  nonnegativeNumber,
  rating,
  id,
  parseRecord,
  parseValue,
  unique,
} from '../../validation'
import { parseDateBounds, parseMonthDate } from '../../date'
import { episodeTypeSchema, extraTypeSchema, partWorkType } from '../parts'
import {
  characterRefSchema,
  characterRoles,
  personRoles,
  organizationRoles,
  personRefSchema,
  organizationRefSchema,
  workRelationTypes,
} from '../relations'
import {
  workTypes,
  workRefSchema,
  languageSchema,
  statusSchema,
  releaseStatusSchema,
  genderSchema,
  entryTypes,
} from '../catalog'
import { DesktopError } from '../../errors'
import { entryFieldTypes } from './fields'

/** Whole-value presence is separate from numeric zero, false, and a known empty authoritative answer. */
export type Presence = { readonly op: 'present' } | { readonly op: 'absent' }

export type NumberTest = { readonly op: 'range'; readonly bounds: Bounds<number> }

export type TextTest = { readonly op: 'equals' | 'contains'; readonly value: string }

export type SetTest<T> =
  | { readonly op: 'any' | 'all' | 'none'; readonly values: NonEmptyArray<T> }
  | { readonly op: 'empty' | 'notEmpty' }

export type EnumTest<T> = { readonly op: 'in' | 'notIn'; readonly values: NonEmptyArray<T> }

/** Civil ranges contain every possible day of the saved fact; component conditions require known components. */
export type DateTest =
  | { readonly op: 'absoluteRange'; readonly bounds: Bounds<YearDate> }
  | {
      readonly op: 'componentRange'
      readonly component: 'year' | 'month' | 'day'
      readonly bounds: Bounds<number>
    }
  | {
      readonly op: 'componentPresent' | 'componentAbsent'
      readonly component: 'year' | 'month' | 'day'
    }
  | Presence

export type BirthdayTest =
  DateTest | { readonly op: 'monthDayRange'; readonly from: MonthDate; readonly to: MonthDate }

/** Calendar ranges use the actual display zone; instant bounds use UTC milliseconds and [from, to). */
export type InstantTest =
  | { readonly op: 'calendarRange'; readonly bounds: Bounds<YearDate> }
  | ({ readonly op: 'instantRange' } & (
      | { readonly from: number; readonly to?: number }
      | { readonly from?: number; readonly to: number }
    ))
  | Presence

/** Counts remain distinct: registered rows, completion marks, file associations and saved accessible observations. */
export type PartCountMeasure = 'registered' | 'completed' | 'withFiles' | 'accessible'

export type PartCountScope =
  | {
      readonly partType: 'animeEpisode'
      readonly classification?: EnumTest<AnimeEpisodeType | null>
    }
  | { readonly partType: 'animeExtra'; readonly classification?: EnumTest<AnimeExtraType | null> }
  | { readonly partType: 'comicVolume' | 'comicChapter' | 'novelVolume' }

/** A relation condition's qualifiers all apply to the same real relation before its targets are projected. */
export type CharacterQualifier =
  | { readonly type: 'none' | 'any' }
  | { readonly type: 'oneOf'; readonly refs: NonEmptyArray<EntryRef<'character'>> }

interface NoteQualifier {
  readonly note?: TextTest | Presence
}

interface CharacterRolesQualifier {
  readonly characterRoles?: NonEmptyArray<CharacterRole | null>
}

interface PersonRolesQualifier {
  readonly personRoles?: NonEmptyArray<PersonRole>
}

interface WorkTypesQualifier {
  readonly workTypes?: NonEmptyArray<WorkRef['type']>
}

interface WorksQualifier extends WorkTypesQualifier {
  readonly works?: NonEmptyArray<WorkRef>
}

interface PersonCharacterQualifier extends CharacterRolesQualifier, PersonRolesQualifier {
  readonly character?: CharacterQualifier
}

/** Each branch permits exactly its listed target kind and qualifiers, never an arbitrary relation path. */
export type EntryRelationCondition =
  | {
      readonly field: 'workCharacters'
      readonly targets: SetTest<EntryRef<'character'>>
      readonly where?: NoteQualifier & CharacterRolesQualifier
    }
  | {
      readonly field: 'workPersons'
      readonly targets: SetTest<EntryRef<'person'>>
      readonly where?: NoteQualifier & PersonCharacterQualifier
    }
  | {
      readonly field: 'workCharacterPersons'
      readonly targets: SetTest<EntryRef<'person'>>
      readonly where?: NoteQualifier &
        Omit<PersonCharacterQualifier, 'character'> & {
          readonly character?:
            | Exclude<CharacterQualifier, { readonly type: 'none' | 'any' }>
            | { readonly type: 'any' }
        }
    }
  | {
      readonly field: 'workOrganizations'
      readonly targets: SetTest<EntryRef<'organization'>>
      readonly where?: NoteQualifier & {
        readonly organizationRoles?: NonEmptyArray<OrganizationRole>
      }
    }
  | {
      readonly field: 'relatedWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: NoteQualifier &
        WorkTypesQualifier & { readonly relationTypes?: NonEmptyArray<WorkRelationType> }
    }
  | {
      readonly field: 'characterWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: NoteQualifier & WorkTypesQualifier & CharacterRolesQualifier
    }
  | {
      readonly field: 'characterPersons'
      readonly targets: SetTest<EntryRef<'person'>>
      readonly where?: NoteQualifier & WorksQualifier & PersonRolesQualifier
    }
  | {
      readonly field: 'personWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: NoteQualifier & WorkTypesQualifier & PersonCharacterQualifier
    }
  | {
      readonly field: 'personCharacters'
      readonly targets: SetTest<EntryRef<'character'>>
      readonly where?: NoteQualifier &
        WorksQualifier &
        PersonRolesQualifier &
        CharacterRolesQualifier
    }
  | {
      readonly field: 'organizationWorks'
      readonly targets: SetTest<WorkRef>
      readonly where?: NoteQualifier &
        WorkTypesQualifier & { readonly organizationRoles?: NonEmptyArray<OrganizationRole> }
    }

/** Closed scalar, civil-date, completion and relation predicates. A rule cannot contain nested rule groups. */
export type EntryCondition =
  | {
      readonly field:
        | 'favorite'
        | 'isNsfw'
        | 'hasNotes'
        | 'hasPrimaryImage'
        | 'hasBackdrop'
        | 'hasTitleLogo'
        | 'hasIcon'
      readonly op: 'is'
      readonly value: boolean
    }
  | ({
      readonly field:
        'originalName' | 'sortName' | 'description' | 'aliases' | 'externalLinks' | 'addedDate'
    } & Presence)
  | ({
      readonly field:
        | 'rating'
        | 'declaredDurationMs'
        | 'declaredRegularEpisodeCount'
        | 'declaredSpecialEpisodeCount'
        | 'declaredPageCount'
        | 'declaredVolumeCount'
        | 'declaredChapterCount'
    } & (NumberTest | Presence))
  | ({
      readonly field:
        | 'additionalDurationMs'
        | 'totalDurationMs'
        | 'completionCount'
        | 'registeredFileCount'
        | 'accessibleFileCount'
        | 'uncheckedFileCount'
    } & NumberTest)
  | ({ readonly field: 'tags' | 'manualCollections' | 'sources' } & SetTest<string>)
  | ({ readonly field: 'originalLanguages' } & SetTest<LanguageTag>)
  | ({ readonly field: 'status' } & EnumTest<WorkStatus | null>)
  | ({ readonly field: 'releaseStatus' } & EnumTest<ReleaseStatus | null>)
  | ({ readonly field: 'gender' } & EnumTest<Gender | null>)
  | ({ readonly field: 'bloodType' } & EnumTest<BloodType | null>)
  | ({ readonly field: 'age' | 'height' | 'weight' | 'bust' | 'waist' | 'hips' } & (
      NumberTest | TextTest | Presence | { readonly op: 'kind'; readonly value: 'number' | 'text' }
    ))
  | ({ readonly field: 'cupSize' } & (TextTest | Presence))
  | ({ readonly field: 'effectiveAddedDate' } & Exclude<DateTest, { readonly op: 'absent' }>)
  | ({
      readonly field:
        | 'releaseDate'
        | 'releaseEndDate'
        | 'deathDate'
        | 'foundedDate'
        | 'dissolvedDate'
        | 'firstCompletedDate'
        | 'lastCompletedDate'
    } & DateTest)
  | ({ readonly field: 'birthDate' } & BirthdayTest)
  | ({ readonly field: 'createdAt' | 'updatedAt' } & Exclude<InstantTest, Presence>)
  | ({ readonly field: 'lastActiveAt' } & InstantTest)
  | ({
      readonly field: 'parts'
      readonly scope: PartCountScope
      readonly measure: PartCountMeasure
    } & NumberTest)
  | {
      readonly field: 'completions'
      readonly match: 'exists' | 'notExists'
      readonly where: { readonly completedDate?: DateTest; readonly note?: TextTest | Presence }
    }
  | EntryRelationCondition

/** Enabled groups form a union; scope/search/visibility always intersect that union. Disabled groups still parse. */
export interface EntryRule {
  readonly enabled: boolean
  readonly types: NonEmptyArray<EntryType>
  readonly filter: { readonly match: 'all' | 'any'; readonly conditions: readonly EntryCondition[] }
}

function selections<T extends v.GenericSchema>(schema: T) {
  return v.pipe(
    v.tupleWithRest([schema], schema),
    v.transform((items) => {
      const [first, ...rest] = items
      const result: [v.InferOutput<T>, ...v.InferOutput<T>[]] = [first]
      const seen = new Set([JSON.stringify(first)])
      for (const item of rest) {
        const key = JSON.stringify(item)
        if (!seen.has(key)) {
          seen.add(key)
          result.push(item)
        }
      }

      return result
    }),
  )
}

function setTest<T extends v.GenericSchema>(schema: T) {
  return v.union([
    v.strictObject({ op: v.picklist(['any', 'all', 'none']), values: selections(schema) }),
    v.strictObject({ op: v.picklist(['empty', 'notEmpty']) }),
  ])
}

function enumTest<T extends v.GenericSchema>(schema: T) {
  return v.strictObject({ op: v.picklist(['in', 'notIn']), values: selections(schema) })
}

function numericBounds<T extends v.GenericSchema<unknown, number>>(schema: T) {
  return v.pipe(
    v.strictObject({ min: v.exactOptional(schema), max: v.exactOptional(schema) }),
    v.check(
      (value) =>
        (value.min !== undefined || value.max !== undefined) &&
        (value.min === undefined || value.max === undefined || value.min <= value.max),
    ),
  )
}

function numberTest<T extends v.GenericSchema<unknown, number>>(schema: T) {
  return v.strictObject({ op: v.literal('range'), bounds: numericBounds(schema) })
}

export const presenceSchema = v.strictObject({ op: v.picklist(['present', 'absent']) })

export const textTestSchema = v.strictObject({
  op: v.picklist(['equals', 'contains']),
  value: nonemptyText,
})

const textOrPresence = v.union([textTestSchema, presenceSchema])

const dateBoundsSchema = v.pipe(v.unknown(), v.transform(parseDateBounds))

const dateRangeSchema = v.strictObject({ op: v.literal('absoluteRange'), bounds: dateBoundsSchema })

const componentRangeSchema = v.union([
  v.strictObject({
    op: v.literal('componentRange'),
    component: v.literal('year'),
    bounds: numericBounds(integer),
  }),
  v.strictObject({
    op: v.literal('componentRange'),
    component: v.literal('month'),
    bounds: numericBounds(v.pipe(integer, v.minValue(1), v.maxValue(12))),
  }),
  v.strictObject({
    op: v.literal('componentRange'),
    component: v.literal('day'),
    bounds: numericBounds(v.pipe(integer, v.minValue(1), v.maxValue(31))),
  }),
])

const componentPresenceSchema = v.strictObject({
  op: v.picklist(['componentPresent', 'componentAbsent']),
  component: v.picklist(['year', 'month', 'day']),
})

const knownDateTestSchema = v.union([
  dateRangeSchema,
  componentRangeSchema,
  componentPresenceSchema,
])

export const dateTestSchema = v.union([knownDateTestSchema, presenceSchema])

const birthdayTestSchema = v.union([
  dateTestSchema,
  v.strictObject({
    op: v.literal('monthDayRange'),
    from: v.pipe(v.unknown(), v.transform(parseMonthDate)),
    to: v.pipe(v.unknown(), v.transform(parseMonthDate)),
  }),
])

const instantRangeSchema = v.pipe(
  v.strictObject({
    op: v.literal('instantRange'),
    from: v.exactOptional(timestamp),
    to: v.exactOptional(timestamp),
  }),
  v.check(
    (value) =>
      (value.from !== undefined || value.to !== undefined) &&
      (value.from === undefined || value.to === undefined || value.from < value.to),
  ),
)

const knownInstantTestSchema = v.union([
  instantRangeSchema,
  v.strictObject({ op: v.literal('calendarRange'), bounds: dateBoundsSchema }),
])

const instantTestSchema = v.union([knownInstantTestSchema, presenceSchema])

export const partCountScopeSchema = v.variant('partType', [
  v.strictObject({
    partType: v.literal('animeEpisode'),
    classification: v.exactOptional(enumTest(v.nullable(episodeTypeSchema))),
  }),
  v.strictObject({
    partType: v.literal('animeExtra'),
    classification: v.exactOptional(enumTest(v.nullable(extraTypeSchema))),
  }),
  v.strictObject({ partType: v.picklist(['comicVolume', 'comicChapter', 'novelVolume']) }),
])

export const partMeasure = v.picklist(['registered', 'completed', 'withFiles', 'accessible'])

const booleanTest = v.strictObject({ op: v.literal('is'), value: v.boolean() })

const nullableCountTest = v.union([numberTest(nonnegativeInteger), presenceSchema])

const measureTest = v.union([
  numberTest(nonnegativeNumber),
  textTestSchema,
  presenceSchema,
  v.strictObject({ op: v.literal('kind'), value: v.picklist(['number', 'text']) }),
])

const characterQualifier = v.union([
  v.strictObject({ type: v.picklist(['none', 'any']) }),
  v.strictObject({ type: v.literal('oneOf'), refs: selections(characterRefSchema) }),
])

const characterOnlyQualifier = v.union([
  v.strictObject({ type: v.literal('any') }),
  v.strictObject({ type: v.literal('oneOf'), refs: selections(characterRefSchema) }),
])

const noteWhere = { note: v.exactOptional(textOrPresence) }

const characterRolesWhere = {
  characterRoles: v.exactOptional(selections(v.nullable(v.picklist(characterRoles)))),
}

const personRolesWhere = { personRoles: v.exactOptional(selections(v.picklist(personRoles))) }

const workTypesWhere = { workTypes: v.exactOptional(selections(v.picklist(workTypes))) }

const worksWhere = { ...workTypesWhere, works: v.exactOptional(selections(workRefSchema)) }

const personCharacterWhere = {
  ...personRolesWhere,
  ...characterRolesWhere,
  character: v.exactOptional(characterQualifier),
}

const organizationWhere = {
  organizationRoles: v.exactOptional(selections(v.picklist(organizationRoles))),
}

function relationTest<T extends v.GenericSchema, W extends v.ObjectEntries>(target: T, where: W) {
  return v.strictObject({ targets: setTest(target), where: v.exactOptional(v.strictObject(where)) })
}

const conditionSchemas: Readonly<
  Record<EntryCondition['field'], v.GenericSchema<unknown, object>>
> = {
  favorite: booleanTest,
  isNsfw: booleanTest,
  hasNotes: booleanTest,
  hasPrimaryImage: booleanTest,
  hasBackdrop: booleanTest,
  hasTitleLogo: booleanTest,
  hasIcon: booleanTest,

  originalName: presenceSchema,
  sortName: presenceSchema,
  description: presenceSchema,
  aliases: presenceSchema,
  externalLinks: presenceSchema,
  addedDate: presenceSchema,

  rating: v.union([numberTest(rating), presenceSchema]),

  tags: setTest(id),
  manualCollections: setTest(id),
  sources: setTest(id),
  originalLanguages: setTest(languageSchema),

  status: enumTest(v.nullable(statusSchema)),
  releaseStatus: enumTest(v.nullable(releaseStatusSchema)),
  gender: enumTest(v.nullable(genderSchema)),
  bloodType: enumTest(v.nullable(v.picklist(['a', 'b', 'ab', 'o']))),

  additionalDurationMs: numberTest(nonnegativeInteger),
  totalDurationMs: numberTest(nonnegativeInteger),
  completionCount: numberTest(nonnegativeInteger),
  declaredDurationMs: nullableCountTest,
  declaredRegularEpisodeCount: nullableCountTest,
  declaredSpecialEpisodeCount: nullableCountTest,
  declaredPageCount: nullableCountTest,
  declaredVolumeCount: nullableCountTest,
  declaredChapterCount: nullableCountTest,
  registeredFileCount: numberTest(nonnegativeInteger),
  accessibleFileCount: numberTest(nonnegativeInteger),
  uncheckedFileCount: numberTest(nonnegativeInteger),

  age: measureTest,
  height: measureTest,
  weight: measureTest,
  bust: measureTest,
  waist: measureTest,
  hips: measureTest,
  cupSize: textOrPresence,

  effectiveAddedDate: v.union([knownDateTestSchema, v.strictObject({ op: v.literal('present') })]),
  releaseDate: dateTestSchema,
  releaseEndDate: dateTestSchema,
  birthDate: birthdayTestSchema,
  deathDate: dateTestSchema,
  foundedDate: dateTestSchema,
  dissolvedDate: dateTestSchema,
  firstCompletedDate: dateTestSchema,
  lastCompletedDate: dateTestSchema,

  createdAt: knownInstantTestSchema,
  updatedAt: knownInstantTestSchema,
  lastActiveAt: instantTestSchema,

  parts: v.strictObject({
    scope: partCountScopeSchema,
    measure: partMeasure,
    op: v.literal('range'),
    bounds: numericBounds(nonnegativeInteger),
  }),

  completions: v.strictObject({
    match: v.picklist(['exists', 'notExists']),
    where: v.strictObject({
      completedDate: v.exactOptional(dateTestSchema),
      note: v.exactOptional(textOrPresence),
    }),
  }),

  workCharacters: relationTest(characterRefSchema, { ...characterRolesWhere, ...noteWhere }),
  workPersons: relationTest(personRefSchema, { ...personCharacterWhere, ...noteWhere }),
  workCharacterPersons: relationTest(personRefSchema, {
    ...personRolesWhere,
    ...characterRolesWhere,
    character: v.exactOptional(characterOnlyQualifier),
    ...noteWhere,
  }),
  workOrganizations: relationTest(organizationRefSchema, { ...organizationWhere, ...noteWhere }),
  relatedWorks: relationTest(workRefSchema, {
    ...workTypesWhere,
    relationTypes: v.exactOptional(selections(v.picklist(workRelationTypes))),
    ...noteWhere,
  }),

  characterWorks: relationTest(workRefSchema, {
    ...workTypesWhere,
    ...characterRolesWhere,
    ...noteWhere,
  }),
  characterPersons: relationTest(personRefSchema, {
    ...worksWhere,
    ...personRolesWhere,
    ...noteWhere,
  }),

  personWorks: relationTest(workRefSchema, {
    ...workTypesWhere,
    ...personCharacterWhere,
    ...noteWhere,
  }),
  personCharacters: relationTest(characterRefSchema, {
    ...worksWhere,
    ...personRolesWhere,
    ...characterRolesWhere,
    ...noteWhere,
  }),

  organizationWorks: relationTest(workRefSchema, {
    ...workTypesWhere,
    ...organizationWhere,
    ...noteWhere,
  }),
}

/** Parse one predicate, normalizing duplicate selections while rejecting unknown fields, operations and qualifiers. */
export function parseEntryCondition(input: unknown): EntryCondition {
  const { field: fieldInput, ...body } = parseRecord(input)
  const field = parseValue(nonemptyText, fieldInput, 'Invalid entry condition')
  if (!Object.hasOwn(conditionSchemas, field)) {
    throw new DesktopError('InvalidInput', 'Unknown entry condition field')
  }

  const condition = {
    field,
    ...parseValue(
      conditionSchemas[field as EntryCondition['field']],
      body,
      'Invalid entry condition',
    ),
  } as EntryCondition
  if (
    (condition.field === 'workPersons' || condition.field === 'personWorks') &&
    condition.where?.character?.type === 'none' &&
    condition.where.characterRoles
  ) {
    throw new DesktopError(
      'InvalidInput',
      'A character role cannot qualify work without a character',
    )
  }

  return condition
}

/** Parse the actual part-count subset; unknown anime classification is represented by null, not a stored enum. */
export function parsePartCountScope(input: unknown): PartCountScope {
  return parseValue(partCountScopeSchema, input, 'Invalid part count scope')
}

/** Determine the types whose facts this parsed predicate can compare. */
export function getEntryConditionTypes(condition: EntryCondition): readonly EntryType[] {
  return condition.field === 'parts'
    ? [partWorkType(condition.scope.partType)]
    : entryFieldTypes[condition.field]
}

/** Strictly validate all groups, including disabled ones. Current reference existence belongs to actual execution. */
export function parseEntryRule(input: unknown): EntryRule {
  const rule = parseValue(
    v.strictObject({
      enabled: v.boolean(),
      types: v.pipe(
        v.tupleWithRest([v.picklist(entryTypes)], v.picklist(entryTypes)),
        v.check((types) => unique(types, (type) => type)),
      ),
      filter: v.strictObject({
        match: v.picklist(['all', 'any']),
        conditions: v.array(v.pipe(v.unknown(), v.transform(parseEntryCondition))),
      }),
    }),
    input,
    'Invalid entry rule',
  )
  for (const condition of rule.filter.conditions) {
    const types = getEntryConditionTypes(condition)
    if (!rule.types.every((type) => types.includes(type))) {
      throw new DesktopError('InvalidInput', 'Condition is not applicable to every rule type')
    }
  }

  return rule
}
