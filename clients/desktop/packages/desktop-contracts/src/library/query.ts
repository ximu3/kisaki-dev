/** @fileoverview Parses the closed query language and checks type applicability before any database evaluation. */

import * as v from 'valibot'
import { parseDateBounds, parseMonthDate } from '../date'
import { DesktopError } from '../errors'
import {
  id,
  integer,
  intervalEntries,
  nonemptyText,
  nonnegativeInteger,
  nonnegativeNumber,
  parseValue,
  rating,
  readRecord,
  text,
  timestamp,
  unique,
} from '../validation'
import {
  entryRefSchema,
  entryTypes,
  genderSchema,
  languageSchema,
  releaseStatusSchema,
  statusSchema,
  workRefSchema,
  workTypes,
} from './catalog'
import type { EntryType } from './catalog'
import { episodeTypeSchema, extraTypeSchema, partWorkType } from './parts'
import {
  characterRefSchema,
  characterRoles,
  organizationRefSchema,
  organizationRoles,
  personRefSchema,
  personRoles,
  workRelationTypes,
} from './relations'
import type {
  DynamicRules,
  EntryCondition,
  EntryGroupKey,
  EntryListOptions,
  EntryLocateOptions,
  EntryProjectionField,
  EntryQuery,
  EntryRule,
  EntrySelection,
  EntrySort,
  EntrySortField,
  PartCountScope,
  QueryReferenceLabel,
} from './query-values'

const mediaTypes = ['anime', 'comic', 'novel'] as const
const bookTypes = ['comic', 'novel'] as const
const peopleTypes = ['character', 'person'] as const

/** Pure applicability only; no SQL, presentation control or persistent schema is stored in this directory. */
export const entryFieldTypes: Readonly<
  Record<EntryCondition['field'] | EntrySortField | EntryProjectionField, readonly EntryType[]>
> = {
  name: entryTypes,
  originalName: entryTypes,
  sortName: entryTypes,
  effectiveSortName: entryTypes,
  aliases: entryTypes,
  description: entryTypes,
  externalLinks: entryTypes,
  primaryImageId: entryTypes,

  favorite: entryTypes,
  rating: entryTypes,
  isNsfw: entryTypes,
  hasNotes: entryTypes,
  hasPrimaryImage: entryTypes,
  tags: entryTypes,
  manualCollections: entryTypes,
  sources: entryTypes,

  addedDate: entryTypes,
  effectiveAddedDate: entryTypes,
  createdAt: entryTypes,
  updatedAt: entryTypes,

  status: workTypes,
  releaseDate: workTypes,
  originalLanguages: workTypes,
  hasBackdrop: workTypes,
  hasTitleLogo: workTypes,
  hasIcon: ['game'],

  additionalDurationMs: workTypes,
  totalDurationMs: workTypes,
  lastActiveAt: workTypes,
  completionCount: workTypes,
  firstCompletedDate: workTypes,
  lastCompletedDate: workTypes,
  completions: workTypes,

  releaseStatus: mediaTypes,
  releaseEndDate: mediaTypes,
  declaredDurationMs: ['anime'],
  declaredRegularEpisodeCount: ['anime'],
  declaredSpecialEpisodeCount: ['anime'],
  declaredPageCount: bookTypes,
  declaredVolumeCount: bookTypes,
  declaredChapterCount: ['comic'],

  registeredFileCount: mediaTypes,
  accessibleFileCount: mediaTypes,
  uncheckedFileCount: mediaTypes,
  parts: mediaTypes,
  partCounts: mediaTypes,

  birthDate: peopleTypes,
  birthMonthDay: peopleTypes,
  gender: peopleTypes,
  deathDate: ['person'],
  bloodType: ['character'],
  age: ['character'],
  height: ['character'],
  weight: ['character'],
  bust: ['character'],
  waist: ['character'],
  hips: ['character'],
  cupSize: ['character'],

  foundedDate: ['organization'],
  dissolvedDate: ['organization'],

  workCharacters: workTypes,
  workPersons: workTypes,
  workCharacterPersons: workTypes,
  workOrganizations: workTypes,
  relatedWorks: workTypes,

  characterWorks: ['character'],
  characterPersons: ['character'],

  personWorks: ['person'],
  personCharacters: ['person'],

  organizationWorks: ['organization'],
}

/** The entire sortable scalar catalog; boolean, enum and arbitrary collection encodings have no sort meaning. */
export const entrySortFields: readonly EntrySortField[] = Object.freeze([
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
  'declaredDurationMs',
  'declaredRegularEpisodeCount',
  'declaredSpecialEpisodeCount',
  'declaredPageCount',
  'declaredVolumeCount',
  'declaredChapterCount',
  'birthDate',
  'birthMonthDay',
  'deathDate',
  'foundedDate',
  'dissolvedDate',
  'age',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'registeredFileCount',
  'accessibleFileCount',
  'uncheckedFileCount',
])

/** Requested list columns are bounded scalar facts and summaries, never arbitrary relation expansions or full bodies. */
export const entryProjectionFields: readonly EntryProjectionField[] = Object.freeze([
  'originalName',
  'sortName',
  'primaryImageId',
  'isNsfw',
  'favorite',
  'rating',
  'addedDate',
  'effectiveAddedDate',
  'createdAt',
  'updatedAt',
  'releaseDate',
  'originalLanguages',
  'status',
  'additionalDurationMs',
  'releaseStatus',
  'releaseEndDate',
  'declaredDurationMs',
  'declaredRegularEpisodeCount',
  'declaredSpecialEpisodeCount',
  'declaredPageCount',
  'declaredVolumeCount',
  'declaredChapterCount',
  'birthDate',
  'gender',
  'deathDate',
  'bloodType',
  'age',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cupSize',
  'foundedDate',
  'dissolvedDate',
  'totalDurationMs',
  'lastActiveAt',
  'completionCount',
  'firstCompletedDate',
  'lastCompletedDate',
  'registeredFileCount',
  'accessibleFileCount',
  'uncheckedFileCount',
  'partCounts',
])

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

const partCountScopeSchema = v.variant('partType', [
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

const partMeasure = v.picklist(['registered', 'completed', 'withFiles', 'accessible'])
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
  const { field: fieldInput, ...body } = readRecord(input)
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

/** Parse a complete sort and check its field across every enabled type; no types still requires a known shape. */
export function parseEntrySort(input: unknown, types: readonly EntryType[] = []): EntrySort {
  const sort = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('scope') }),
      v.strictObject({
        type: v.literal('field'),
        field: v.picklist(entrySortFields),
        direction: v.picklist(['asc', 'desc']),
      }),
      v.strictObject({
        type: v.literal('parts'),
        scope: partCountScopeSchema,
        measure: partMeasure,
        direction: v.picklist(['asc', 'desc']),
      }),
    ]),
    input,
    'Invalid entry sort',
  )

  let applicable: readonly EntryType[] = entryTypes
  if (sort.type === 'parts') {
    applicable = [partWorkType(sort.scope.partType)]
  } else if (sort.type === 'field') {
    applicable = entryFieldTypes[sort.field]
  }
  if (!types.every((type) => applicable.includes(type))) {
    throw new DesktopError('InvalidInput', 'Sort is not applicable to every enabled type')
  }

  return sort
}

const entryScopeSchema = v.union([
  v.strictObject({ type: v.picklist(['library', 'favorites', 'unclassified']) }),
  v.strictObject({ type: v.picklist(['collection', 'tag', 'note']), id }),
])

const queryRulesSchema = v.array(v.pipe(v.unknown(), v.transform(parseEntryRule)))

const groupSchema = v.union([
  v.strictObject({ type: v.literal('collection'), id }),
  v.strictObject({ type: v.literal('unclassified') }),
])

/** Parse exact scope/search/rules/sort. Empty or entirely disabled rules remain an intentionally empty result. */
export function parseEntryQuery(input: unknown): EntryQuery {
  const value = parseValue(
    v.strictObject({
      scope: entryScopeSchema,
      search: text,
      rules: queryRulesSchema,
      sort: v.unknown(),
    }),
    input,
    'Invalid entry query',
  )

  const types = value.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types)
  return { ...value, sort: parseEntrySort(value.sort, types) }
}

function checkProjection(
  fields: readonly EntryProjectionField[] | undefined,
  query: EntryQuery,
): void {
  const types = query.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types)
  if (
    types.length > 0 &&
    fields?.some((field) => !types.some((type) => entryFieldTypes[field].includes(type)))
  ) {
    throw new DesktopError(
      'InvalidInput',
      'A requested field is not applicable to any enabled type',
    )
  }
}

const projectionSchema = v.pipe(
  v.array(v.picklist(entryProjectionFields)),
  v.transform((fields) => [...new Set(fields)]),
)

/** Parse the interval against a previously parsed query; an unsupported requested column never becomes a null field. */
export function parseEntryListOptions(input: unknown, query: EntryQuery): EntryListOptions {
  const value = parseValue(
    v.strictObject({
      ...intervalEntries,
      fields: v.exactOptional(projectionSchema),
      group: v.exactOptional(groupSchema),
    }),
    input,
    'Invalid entry list options',
  )
  checkProjection(value.fields, query)
  return value
}

/** Locate uses the same projection and group semantics as list, without a caller-supplied offset. */
export function parseEntryLocateOptions(input: unknown, query: EntryQuery): EntryLocateOptions {
  const value = parseValue(
    v.strictObject({
      limit: intervalEntries.limit,
      fields: v.exactOptional(projectionSchema),
      group: v.exactOptional(groupSchema),
    }),
    input,
    'Invalid entry locate options',
  )
  checkProjection(value.fields, query)
  return value
}

/** Center the real target when possible and fill the last interval; absent targets must be returned as null instead. */
export function entryLocateOffset(index: number, total: number, limit: number): number {
  const value = parseValue(
    v.strictObject({
      index: nonnegativeInteger,
      total: nonnegativeInteger,
      limit: intervalEntries.limit,
    }),
    { index, total, limit },
  )
  if (value.index >= value.total) {
    throw new DesktopError('InvalidInput', 'The located index must belong to the result')
  }

  return Math.max(0, Math.min(index - Math.floor(limit / 2), total - limit))
}

function groupKey(group: EntryGroupKey): string {
  return group.type === 'collection' ? JSON.stringify(['collection', group.id]) : 'unclassified'
}

/** Validate fixed selection intent; actual missing endpoints or unreadable crossed groups become SelectionChanged at execution. */
export function parseEntrySelection(input: unknown): EntrySelection {
  const endpoint = v.strictObject({ group: groupSchema, ref: entryRefSchema })
  const value = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('all') }),
      v.strictObject({ type: v.literal('range'), anchor: entryRefSchema, focus: entryRefSchema }),
      v.strictObject({
        type: v.literal('groupRange'),
        anchor: endpoint,
        focus: endpoint,
        expandedGroups: v.pipe(
          v.array(groupSchema),
          v.check((groups) => unique(groups, groupKey)),
        ),
      }),
    ]),
    input,
    'Invalid fixed entry selection',
  )
  if (value.type === 'groupRange') {
    const groups = new Set(value.expandedGroups.map(groupKey))
    if (!groups.has(groupKey(value.anchor.group)) || !groups.has(groupKey(value.focus.group))) {
      throw new DesktopError(
        'InvalidInput',
        'Selection endpoints must belong to declared expanded groups',
      )
    }
  }
  return value
}

/** Validate display-only snapshots with exact, unique target identities; labels grant no lookup authority. */
export function parseQueryReferenceLabels(input: unknown): readonly QueryReferenceLabel[] {
  const label = v.strictObject({
    target: v.union([
      entryRefSchema,
      v.strictObject({ type: v.picklist(['collection', 'tag', 'note']), id }),
    ]),
    name: nonemptyText,
  })
  return parseValue(
    v.pipe(
      v.array(label),
      v.check((labels) =>
        unique(labels, (item) => JSON.stringify([item.target.type, item.target.id])),
      ),
    ),
    input,
    'Invalid saved query reference labels',
  )
}

/** Parse saved membership and sort separately from its display-only reference labels; labels grant no lookup authority. */
export function parseDynamicRules(input: unknown): DynamicRules {
  const value = parseValue(
    v.strictObject({
      search: text,
      rules: queryRulesSchema,
      sort: v.unknown(),
      referenceLabels: v.pipe(v.unknown(), v.transform(parseQueryReferenceLabels)),
    }),
    input,
    'Invalid dynamic rules',
  )

  const sort = parseEntrySort(
    value.sort,
    value.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types),
  )
  if (sort.type === 'scope') {
    throw new DesktopError('InvalidInput', 'Dynamic rules require an explicit sort')
  }

  return { ...value, sort }
}
