/** @fileoverview Defines the finite entry-query language and type-correlated projections used by every desktop reader. */

import type { CalendarDate, MonthDate, PartialDate, YearDate } from '../date'
import type { ErrorSummary } from '../errors'
import type { Bounds, NonEmptyArray } from '../operations'
import type {
  AnimeEpisodeType,
  AnimeExtraType,
  BloodType,
  CharacterMeasure,
  EntryRef,
  EntryType,
  Gender,
  LanguageTag,
  ReleaseStatus,
  WorkRef,
  WorkStatus,
} from './catalog'
import type { CharacterRole, OrganizationRole, PersonRole, WorkRelationType } from './relations'

/** The fixed entrance always intersects rules, search and the caller's actual visibility. */
export type EntryScope =
  | { readonly type: 'library' | 'favorites' | 'unclassified' }
  | { readonly type: 'collection' | 'tag' | 'note'; readonly id: string }

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

/** Stable scalar sorting only. Null stays last in either direction; identity tie-breaks remain ascending. */
export type EntrySortField =
  | 'name'
  | 'originalName'
  | 'effectiveSortName'
  | 'rating'
  | 'effectiveAddedDate'
  | 'createdAt'
  | 'updatedAt'
  | 'releaseDate'
  | 'releaseEndDate'
  | 'additionalDurationMs'
  | 'totalDurationMs'
  | 'lastActiveAt'
  | 'completionCount'
  | 'firstCompletedDate'
  | 'lastCompletedDate'
  | 'declaredDurationMs'
  | 'declaredRegularEpisodeCount'
  | 'declaredSpecialEpisodeCount'
  | 'declaredPageCount'
  | 'declaredVolumeCount'
  | 'declaredChapterCount'
  | 'birthDate'
  | 'birthMonthDay'
  | 'deathDate'
  | 'foundedDate'
  | 'dissolvedDate'
  | 'age'
  | 'height'
  | 'weight'
  | 'bust'
  | 'waist'
  | 'hips'
  | 'registeredFileCount'
  | 'accessibleFileCount'
  | 'uncheckedFileCount'
export type EntrySort =
  | { readonly type: 'scope' }
  | { readonly type: 'field'; readonly field: EntrySortField; readonly direction: 'asc' | 'desc' }
  | {
      readonly type: 'parts'
      readonly scope: PartCountScope
      readonly measure: PartCountMeasure
      readonly direction: 'asc' | 'desc'
    }

/** A reusable result-set definition. Interval, requested fields and view components do not belong here. */
export interface EntryQuery {
  readonly scope: EntryScope
  readonly search: string
  readonly rules: readonly EntryRule[]
  readonly sort: EntrySort
}

/** These four counts describe separate facts; unknown anime classification is a read-only grouping key. */
export interface PartCounts {
  readonly registered: number
  readonly completed: number
  readonly withFiles: number
  readonly accessible: number
}
interface CommonProjection {
  readonly originalName: string | null
  readonly sortName: string | null
  readonly primaryImageId: string | null
  readonly isNsfw: boolean
  readonly favorite: boolean
  readonly rating: number | null
  readonly addedDate: PartialDate | null
  readonly effectiveAddedDate: PartialDate
  readonly createdAt: number
  readonly updatedAt: number
}
interface WorkProjection {
  readonly releaseDate: PartialDate | null
  readonly originalLanguages: readonly LanguageTag[]
  readonly status: WorkStatus | null
  readonly additionalDurationMs: number
  readonly totalDurationMs: number
  readonly lastActiveAt: number | null
  readonly completionCount: number
  readonly firstCompletedDate: CalendarDate | null
  readonly lastCompletedDate: CalendarDate | null
}
interface MediaProjection {
  readonly releaseStatus: ReleaseStatus | null
  readonly releaseEndDate: PartialDate | null
  readonly registeredFileCount: number
  readonly accessibleFileCount: number
  readonly uncheckedFileCount: number
}
/** Only applicable branches contain requested fields. Unrequested fields are absent rather than filled with null. */
export interface EntryProjectionByType {
  readonly game: CommonProjection & WorkProjection
  readonly anime: CommonProjection &
    WorkProjection &
    MediaProjection & {
      readonly declaredDurationMs: number | null
      readonly declaredRegularEpisodeCount: number | null
      readonly declaredSpecialEpisodeCount: number | null
      readonly partCounts: {
        readonly animeEpisode: PartCounts & {
          readonly byType: Readonly<Record<AnimeEpisodeType | 'unknown', PartCounts>>
        }
        readonly animeExtra: PartCounts & {
          readonly byType: Readonly<Record<AnimeExtraType | 'unknown', PartCounts>>
        }
      }
    }
  readonly comic: CommonProjection &
    WorkProjection &
    MediaProjection & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
      readonly declaredChapterCount: number | null
      readonly partCounts: { readonly comicVolume: PartCounts; readonly comicChapter: PartCounts }
    }
  readonly novel: CommonProjection &
    WorkProjection &
    MediaProjection & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
      readonly partCounts: { readonly novelVolume: PartCounts }
    }
  readonly character: CommonProjection & {
    readonly birthDate: PartialDate | null
    readonly gender: Gender | null
    readonly bloodType: BloodType | null
    readonly age: CharacterMeasure | null
    readonly height: CharacterMeasure | null
    readonly weight: CharacterMeasure | null
    readonly bust: CharacterMeasure | null
    readonly waist: CharacterMeasure | null
    readonly hips: CharacterMeasure | null
    readonly cupSize: string | null
  }
  readonly person: CommonProjection & {
    readonly birthDate: PartialDate | null
    readonly deathDate: PartialDate | null
    readonly gender: Gender | null
  }
  readonly organization: CommonProjection & {
    readonly foundedDate: PartialDate | null
    readonly dissolvedDate: PartialDate | null
  }
}
export type EntryProjectionField = { [K in EntryType]: keyof EntryProjectionByType[K] }[EntryType]
export type EntryListItem = {
  [K in EntryType]: { readonly id: string; readonly type: K; readonly name: string } & Partial<
    EntryProjectionByType[K]
  >
}[EntryType]

/** Group identity is independent of hidden names and per-view expanded state. */
export type EntryGroupKey =
  { readonly type: 'collection'; readonly id: string } | { readonly type: 'unclassified' }
export interface EntryListOptions {
  readonly offset: number
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}
export interface EntryLocateOptions {
  readonly limit: number
  readonly fields?: readonly EntryProjectionField[]
  readonly group?: EntryGroupKey
}
export interface EntryListResult {
  readonly items: readonly EntryListItem[]
  readonly total: number
}
export interface EntryLocateResult extends EntryListResult {
  readonly index: number
  readonly offset: number
}
export type EntryGroupResult =
  | { readonly key: EntryGroupKey; readonly status: 'ready'; readonly count: number }
  | { readonly key: EntryGroupKey; readonly status: 'failed'; readonly error: ErrorSummary }
export interface EntryGroupsResult {
  readonly total: number
  readonly groups: readonly EntryGroupResult[]
}

/** A one-read fixed selection. Reversed endpoints select the same closed interval; all ignores collapsed groups. */
export type EntrySelection =
  | { readonly type: 'all' }
  | { readonly type: 'range'; readonly anchor: EntryRef; readonly focus: EntryRef }
  | {
      readonly type: 'groupRange'
      readonly anchor: { readonly group: EntryGroupKey; readonly ref: EntryRef }
      readonly focus: { readonly group: EntryGroupKey; readonly ref: EntryRef }
      readonly expandedGroups: readonly EntryGroupKey[]
    }

/** A bounded last-saved display name never resolves an identity or affects query authorization. */
export interface QueryReferenceLabel {
  readonly target: EntryRef | { readonly type: 'tag' | 'collection' | 'note'; readonly id: string }
  readonly name: string
}

/** Dynamic membership is evaluated over the library with an explicit sort, never scope-relative order. */
export interface DynamicRules {
  readonly search: string
  readonly rules: readonly EntryRule[]
  readonly sort: Exclude<EntrySort, { readonly type: 'scope' }>
  readonly referenceLabels: readonly QueryReferenceLabel[]
}
