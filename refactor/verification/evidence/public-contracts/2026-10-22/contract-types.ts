// Declaration-composition fixture; the full domain implementation is not present.
// Referenced owner types below are representative values, not a second published API.
type EntryType = 'game' | 'anime' | 'comic' | 'novel' | 'character' | 'person' | 'organization'
type EntryRef<T extends EntryType = EntryType> = { type: T; id: string }
type PartRef = {
  type: 'novelVolume' | 'comicVolume' | 'comicChapter' | 'animeEpisode' | 'animeExtra'
  id: string
}
type EntryCondition =
  | ({ field: 'rating' } & (NumberTest | Presence))
  | { field: 'favorite'; op: 'is'; value: boolean }
  | ({ field: 'tags' } & SetTest<string>)
  | ({ field: 'status' } & EnumTest<'planned' | 'active' | 'onHold' | null>)
type EntrySortField = 'name' | 'rating' | 'effectiveSortName'
type EntryProjectionField = 'rating' | 'status' | 'birthDate'
type EntryListItem =
  | {
      id: string
      type: 'game'
      name: string
      rating?: number | null
      status?: 'planned' | 'active' | 'onHold' | null
    }
  | {
      id: string
      type: 'person'
      name: string
      rating?: number | null
      birthDate?: { year: number } | null
    }
type AnimeEpisodeType = 'regular' | 'special'
type AnimeExtraType = 'opening' | 'ending' | 'promotion' | 'interview' | 'other'
type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

interface ErrorSummary {
  code: string
  message: string
}

interface ExecutionFailure<Result> extends ErrorSummary {
  partialResult?: Result
}

// Extracted from refactor/design/domains/library-query-contracts.md.
type EntryScope =
  | { type: 'library' }
  | { type: 'favorites' }
  | { type: 'unclassified' }
  | { type: 'collection'; id: string }
  | { type: 'tag'; id: string }
  | { type: 'note'; id: string }

interface EntryQuery {
  scope: EntryScope
  search: string
  rules: readonly EntryRule[]
  sort: EntrySort
}

interface EntryRule {
  enabled: boolean
  types: readonly [EntryType, ...EntryType[]]
  filter: {
    match: 'all' | 'any'
    conditions: readonly EntryCondition[]
  }
}

type EntrySort =
  | { type: 'scope' }
  | { type: 'field'; field: EntrySortField; direction: 'asc' | 'desc' }
  | {
      type: 'parts'
      scope: PartCountScope
      measure: 'registered' | 'completed' | 'withFiles' | 'accessible'
      direction: 'asc' | 'desc'
    }

type PartCountScope =
  | { partType: 'animeEpisode'; classification?: EnumTest<AnimeEpisodeType | null> }
  | { partType: 'animeExtra'; classification?: EnumTest<AnimeExtraType | null> }
  | { partType: 'comicVolume' | 'comicChapter' | 'novelVolume' }

type EntryGroupKey = { type: 'collection'; id: string } | { type: 'unclassified' }

interface EntryListOptions {
  offset: number
  limit: number
  fields?: readonly EntryProjectionField[]
  group?: EntryGroupKey
}

interface EntryLocateOptions {
  limit: number
  fields?: readonly EntryProjectionField[]
  group?: EntryGroupKey
}

interface EntryListResult {
  items: readonly EntryListItem[]
  total: number
}

interface EntryLocateResult extends EntryListResult {
  index: number
  offset: number
}

// Extracted from refactor/design/domains/library-query-contracts.md.
type Bounds<T> = { min: T; max?: T } | { min?: T; max: T }
type Presence = { op: 'present' } | { op: 'absent' }
type NumberTest = { op: 'range'; bounds: Bounds<number> }
type SetTest<T> =
  { op: 'any' | 'all' | 'none'; values: readonly [T, ...T[]] } | { op: 'empty' | 'notEmpty' }
type EnumTest<T> = { op: 'in' | 'notIn'; values: readonly [T, ...T[]] }
type TextTest = { op: 'equals' | 'contains'; value: string }

// Extracted from refactor/design/domains/library-query-contracts.md.
type EntryGroupResult =
  | { key: EntryGroupKey; status: 'ready'; count: number }
  | { key: EntryGroupKey; status: 'failed'; error: ErrorSummary }

type EntrySelection =
  | { type: 'all' }
  | { type: 'range'; anchor: EntryRef; focus: EntryRef }
  | {
      type: 'groupRange'
      anchor: { group: EntryGroupKey; ref: EntryRef }
      focus: { group: EntryGroupKey; ref: EntryRef }
      expandedGroups: readonly EntryGroupKey[]
    }

// Extracted from refactor/design/domains/library-write-contracts.md.
type MembershipChange<Member, Identity> =
  | { type: 'replace'; items: readonly Member[] }
  | { type: 'modify'; add?: readonly Member[]; remove?: readonly Identity[] }

// Extracted from refactor/design/engineering/protocols.md.
type RpcFrame =
  | {
      type: 'hello'
      wireVersion: 1
      protocol: { id: string; version: number }
      context: JsonValue
    }
  | { type: 'accepted'; context: JsonValue }
  | { type: 'rejected'; error: { code: string; message: string } }
  | { type: 'request'; id: number; method: string; args: readonly JsonValue[] }
  | { type: 'success'; id: number; value?: JsonValue }
  | { type: 'failure'; id: number; error: JsonValue }
  | { type: 'notify'; topic: string; value: JsonValue }
  | { type: 'cancel'; id: number }

// Extracted from refactor/design/engineering/protocols.md.
type DevBuildResult =
  | { extensionId: string; buildId: number; outcome: 'adopted' }
  | { extensionId: string; buildId: number; outcome: 'superseded' }
  | { extensionId: string; buildId: number; outcome: 'notAdopted'; error: ErrorSummary }

type DevActivationResult =
  | { extensionId: string; instanceId: string; outcome: 'activated' }
  | { extensionId: string; outcome: 'failed'; error: ErrorSummary }

type DevAdoptionResult = {
  sequence: number
  builds: readonly DevBuildResult[]
  activations: readonly DevActivationResult[]
} & ({ outcome: 'completed' } | { outcome: 'interrupted'; error: ErrorSummary })
const query: EntryQuery = {
  scope: { type: 'collection', id: 'c' },
  search: '',
  rules: [
    {
      enabled: true,
      types: ['game'],
      filter: { match: 'all', conditions: [{ field: 'rating', op: 'range', bounds: { min: 0 } }] }
    }
  ],
  sort: { type: 'scope' }
}
const mixedRows: EntryListItem[] = [
  { id: 'g', type: 'game', name: 'Game', status: null },
  { id: 'p', type: 'person', name: 'Person', birthDate: null }
]
const selection: EntrySelection = {
  type: 'groupRange',
  anchor: { group: { type: 'collection', id: 'a' }, ref: { type: 'game', id: 'g' } },
  focus: { group: { type: 'unclassified' }, ref: { type: 'person', id: 'p' } },
  expandedGroups: [{ type: 'collection', id: 'a' }, { type: 'unclassified' }]
}
const failure: ExecutionFailure<EntryListResult> = {
  code: 'ReadFailed',
  message: 'Read failed.',
  partialResult: { items: [], total: 0 }
}
const successfulVoid: RpcFrame = { type: 'success', id: 1 }
const successfulNull: RpcFrame = { type: 'success', id: 2, value: null }
// @ts-expect-error Scope order has no direction.
const invalidSort: EntrySort = { type: 'scope', direction: 'asc' }
const invalidTypes: EntryRule = {
  enabled: true,
  // @ts-expect-error Enabled rules must explicitly name at least one type.
  types: [],
  filter: { match: 'all', conditions: [] }
}
// @ts-expect-error A range must have at least one bound.
const invalidBounds: NumberTest = { op: 'range', bounds: {} }
// @ts-expect-error Set operands cannot be empty.
const invalidSet: SetTest<string> = { op: 'all', values: [] }
// @ts-expect-error A boolean cannot use numeric range operators.
const invalidCondition: EntryCondition = { field: 'favorite', op: 'range', bounds: { min: 1 } }
// @ts-expect-error Completed is a historical fact, not current status.
const invalidStatus: EntryCondition = { field: 'status', op: 'in', values: ['completed'] }
// @ts-expect-error Field requests are not arbitrary property paths.
const invalidFields: EntryListOptions = { offset: 0, limit: 80, fields: ['private.sql'] }
// @ts-expect-error Person projections do not fake a Work status.
const invalidPerson: EntryListItem = { id: 'p', type: 'person', name: 'P', status: null }
const invalidSelection: EntrySelection = {
  type: 'groupRange',
  // @ts-expect-error Group selection must carry actual display-instance context.
  anchor: { type: 'game', id: 'g' },
  focus: { group: { type: 'unclassified' }, ref: { type: 'game', id: 'h' } },
  expandedGroups: []
}
const invalidFailure: ExecutionFailure<EntryListResult> = {
  code: 'ReadFailed',
  message: 'Read failed.',
  // @ts-expect-error A partial result remains a complete legal result shape.
  partialResult: { items: [] }
}
// @ts-expect-error RPC request arguments are an array of serializable values.
const invalidRequest: RpcFrame = { type: 'request', id: 1, method: 'read', args: [() => 1] }
const invalidHello: RpcFrame = {
  type: 'hello',
  // @ts-expect-error Unsupported wire version is not a valid outbound v1 frame.
  wireVersion: 2,
  protocol: { id: 'p', version: 1 },
  context: {}
}
// @ts-expect-error A failed adoption must include a safe error.
const invalidAdoption: DevBuildResult = { extensionId: 'x', buildId: 1, outcome: 'notAdopted' }
const invalidMembers: MembershipChange<{ tagId: string }, string> = {
  type: 'replace',
  items: [],
  // @ts-expect-error Replacement and incremental member changes are separate branches.
  remove: ['x']
}
const invalidPartScope: PartCountScope = {
  partType: 'comicVolume',
  // @ts-expect-error Comic counts have no anime classification.
  classification: { op: 'in', values: ['regular'] }
}
const invalidExtraScope: PartCountScope = {
  partType: 'animeExtra',
  // @ts-expect-error A special episode is not an anime Extra classification.
  classification: { op: 'in', values: ['special'] }
}
void [query, mixedRows, selection, failure, successfulVoid, successfulNull]
