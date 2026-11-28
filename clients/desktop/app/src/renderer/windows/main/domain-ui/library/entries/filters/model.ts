import {
  entryFieldTypes,
  parseEntryCondition,
  workTypes,
  characterRoles,
  personRoles,
  organizationRoles,
  workRelationTypes,
  type EntryCondition,
  type EntryRule,
  type EntryType,
  type PartType,
} from '@kisaki3/desktop-contracts/library'
export type Field = EntryCondition['field']
export type Draft = Record<string, unknown>
const boolean = ['is'] as const,
  presence = ['present', 'absent'] as const,
  numeric = ['range'] as const,
  optionalNumber = ['range', ...presence] as const,
  set = ['any', 'all', 'none', 'empty', 'notEmpty'] as const,
  enumeration = ['in', 'notIn'] as const,
  partialDate = [
    'absoluteRange',
    'componentRange',
    'componentPresent',
    'componentAbsent',
    ...presence,
  ] as const,
  mixed = ['range', 'equals', 'contains', 'kind', ...presence] as const
export const operators = {
  favorite: boolean,
  isNsfw: boolean,
  hasNotes: boolean,
  hasPrimaryImage: boolean,
  hasBackdrop: boolean,
  hasTitleLogo: boolean,
  hasIcon: boolean,
  originalName: presence,
  sortName: presence,
  description: presence,
  aliases: presence,
  externalLinks: presence,
  addedDate: presence,
  rating: optionalNumber,
  declaredDurationMs: optionalNumber,
  declaredRegularEpisodeCount: optionalNumber,
  declaredSpecialEpisodeCount: optionalNumber,
  declaredPageCount: optionalNumber,
  declaredVolumeCount: optionalNumber,
  declaredChapterCount: optionalNumber,
  additionalDurationMs: numeric,
  additionalCompletionCount: numeric,
  totalDurationMs: numeric,
  completionCount: numeric,
  registeredFileCount: numeric,
  accessibleFileCount: numeric,
  uncheckedFileCount: numeric,
  tags: set,
  manualCollections: set,
  sources: set,
  originalLanguages: set,
  status: enumeration,
  releaseStatus: enumeration,
  gender: enumeration,
  bloodType: enumeration,
  age: mixed,
  height: mixed,
  weight: mixed,
  bust: mixed,
  waist: mixed,
  hips: mixed,
  cupSize: ['equals', 'contains', ...presence],
  effectiveAddedDate: [
    'absoluteRange',
    'componentRange',
    'componentPresent',
    'componentAbsent',
    'present',
  ],
  releaseDate: partialDate,
  releaseEndDate: partialDate,
  deathDate: partialDate,
  foundedDate: partialDate,
  dissolvedDate: partialDate,
  firstCompletedDate: partialDate,
  lastCompletedDate: partialDate,
  birthDate: [...partialDate, 'monthDayRange'],
  createdAt: ['calendarRange', 'instantRange'],
  updatedAt: ['calendarRange', 'instantRange'],
  lastActiveAt: ['calendarRange', 'instantRange', ...presence],
  parts: numeric,
  completions: ['exists', 'notExists'],
  workCharacters: set,
  workPersons: set,
  workCharacterPersons: set,
  workOrganizations: set,
  relatedWorks: set,
  characterWorks: set,
  characterPersons: set,
  personWorks: set,
  personCharacters: set,
  organizationWorks: set,
} as const satisfies Record<Field, readonly string[]>
export type Op = (typeof operators)[Field][number]
export const enumValues: Partial<Record<Field, readonly (string | null)[]>> = {
  status: ['planned', 'active', 'onHold', null],
  releaseStatus: ['planned', 'ongoing', 'finished', 'paused', 'cancelled', null],
  gender: ['male', 'female', 'nonBinary', 'genderless', 'other', null],
  bloodType: ['a', 'b', 'ab', 'o', null],
}
export const relationTargets: Partial<Record<Field, EntryRule['types']>> = {
  workCharacters: ['character'],
  workPersons: ['person'],
  workCharacterPersons: ['person'],
  workOrganizations: ['organization'],
  relatedWorks: workTypes,
  characterWorks: workTypes,
  characterPersons: ['person'],
  personWorks: workTypes,
  personCharacters: ['character'],
  organizationWorks: workTypes,
}
export const qualifiers = {
  workCharacters: ['characterRoles'],
  workPersons: ['personRoles', 'characterRoles', 'character'],
  workCharacterPersons: ['personRoles', 'characterRoles', 'character'],
  workOrganizations: ['organizationRoles'],
  relatedWorks: ['workTypes', 'relationTypes'],
  characterWorks: ['workTypes', 'characterRoles'],
  characterPersons: ['workTypes', 'works', 'personRoles'],
  personWorks: ['workTypes', 'personRoles', 'characterRoles', 'character'],
  personCharacters: ['workTypes', 'works', 'personRoles', 'characterRoles'],
  organizationWorks: ['workTypes', 'organizationRoles'],
} as const
export const qualifierValues = {
  workTypes,
  characterRoles: [...characterRoles, null],
  personRoles,
  organizationRoles,
  relationTypes: workRelationTypes,
}
export function applicable(field: Field, types: readonly EntryType[]) {
  return types.every((type) => (entryFieldTypes[field] as readonly EntryType[]).includes(type))
}
export function object(value: unknown): Draft {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Draft) : {}
}
export function list<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
export function updateObject(original: Draft, changes: Draft) {
  return Object.fromEntries(
    Object.entries({ ...original, ...changes }).filter(([, v]) => v !== undefined),
  )
}
export function newBody(op: Op): Draft {
  switch (op) {
    case 'is':
      return { op, value: true }
    case 'range':
    case 'componentRange':
      return {
        op,
        bounds: { min: 0 },
        ...(op === 'componentRange' && {
          component: 'year',
          bounds: { min: new Date().getFullYear() },
        }),
      }
    case 'absoluteRange':
    case 'calendarRange':
      return { op, bounds: { min: { year: new Date().getFullYear() } } }
    case 'componentPresent':
    case 'componentAbsent':
      return { op, component: 'year' }
    case 'instantRange':
      return { op, from: Date.now() }
    case 'monthDayRange':
      return { op, from: { month: 1, day: 1 }, to: { month: 12, day: 31 } }
    case 'equals':
    case 'contains':
      return { op, value: '' }
    case 'kind':
      return { op, value: 'number' }
    case 'in':
    case 'notIn':
    case 'all':
    case 'any':
    case 'none':
      return { op, values: [] }
    case 'exists':
    case 'notExists':
      return { match: op, where: {} }
    case 'present':
    case 'absent':
    case 'empty':
    case 'notEmpty':
      return { op }
  }
}
export function newCondition(field: Field, types: readonly EntryType[]): Draft {
  const body = newBody(operators[field][0])
  if (relationTargets[field]) {
    return { field, targets: body }
  }
  if (field === 'parts') {
    let partType: PartType = 'novelVolume'
    if (types.includes('anime')) {
      partType = 'animeEpisode'
    } else if (types.includes('comic')) {
      partType = 'comicVolume'
    }
    return { field, ...body, scope: { partType }, measure: 'registered' }
  }
  return { field, ...body }
}
export function parsedFilter(
  match: 'all' | 'any',
  conditions: readonly Draft[],
): EntryRule['filter'] {
  return { match, conditions: conditions.map(parseEntryCondition) }
}
