import type { NonEmptyArray, CallOptions, Disposable } from './operations'
import * as v from 'valibot'
import {
  fromParser,
  parseExternalValue,
  id,
  unique,
  timestamp,
  parseValue,
  parseDictionary,
  parseRecord,
  text,
} from './validation'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseErrorSummary, DesktopError, type ErrorSummary } from './errors'
import {
  parsePreferencesUpdate,
  type PreferencesChanges,
  type PreferencesExpected,
} from './preferences/api'
import {
  parseExtensionPackageSource,
  parseExtensionRepositoryInput,
  type ExtensionPackageSource,
  type ExtensionRepositoryInput,
} from './extensions'
import { parseMetadataProfileCreate, type MetadataProfileCreate } from './metadata/profiles'
import { parseScanConfigCreate, type ScanConfigCreate } from './scanner/configs'
import { parseShowcaseFields, type ShowcaseFields } from './library/showcase'
import { parseApplicationVersion } from './app'

/** Native recommendation groups with independently owned preparation and commit behavior. */
export const onboardingGroups = Object.freeze([
  'preferences',
  'extensions',
  'metadataProfiles',
  'scanner',
  'showcase',
] as const)

export type OnboardingGroup = (typeof onboardingGroups)[number]

export type OnboardingMode = 'firstUse' | 'update' | 'manual'

/** Durable resource created or installed while applying a recommendation. */
export type OnboardingResourceRef<G extends OnboardingGroup = OnboardingGroup> = {
  readonly preferences: never
  readonly extensions: { readonly type: 'extension'; readonly extensionId: string }
  readonly metadataProfiles: { readonly type: 'metadataProfile'; readonly profileId: string }
  readonly scanner: { readonly type: 'scanConfig'; readonly configId: string }
  readonly showcase: { readonly type: 'showcaseSection'; readonly sectionId: string }
}[G]

/** Established applied or skipped outcome with its handling time and any created resources. */
export type OnboardingHandled =
  | {
      readonly outcome: 'skipped'
      /** UTC milliseconds since the Unix epoch. */
      readonly handledAt: number
    }
  | {
      readonly outcome: 'applied'
      /** UTC milliseconds since the Unix epoch. */
      readonly handledAt: number
      readonly resources: readonly OnboardingResourceRef[]
    }

/**
 * Handled keys are stable native catalog identities. Deleted or unavailable resources leave
 * historical outcomes intact.
 */
export interface OnboardingState {
  /** UTC milliseconds since the Unix epoch; null until the guide is actually presented. */
  readonly firstPresentedAt: number | null
  /** UTC milliseconds since the Unix epoch; null until first-use guidance is completed. */
  readonly firstCompletedAt: number | null
  readonly lastPresentedVersion: string | null
  readonly handled: Readonly<Record<string, OnboardingHandled>>
}

/**
 * Applicable recommendation with its native identity, current handling state and group-specific
 * source reference.
 */
export type OnboardingItem = {
  readonly itemId: string
  readonly title: string
  readonly recommendation: string
  readonly handled: OnboardingHandled | null
} & (
  | { readonly group: 'preferences' | 'scanner' }
  | { readonly group: 'extensions'; readonly extensionId: string }
  | { readonly group: 'metadataProfiles' | 'showcase'; readonly presetId: string }
)

/** Existing repositories are referenced by their actual local IDs. */
export type OnboardingExtensionSource =
  | ExtensionPackageSource
  | {
      readonly type: 'newRepository'
      readonly repository: ExtensionRepositoryInput
      readonly extensionId: string
      readonly version: string
      readonly sha256: string
    }

export interface OnboardingInputMap {
  readonly preferences: {
    readonly changes: Pick<PreferencesChanges, 'general' | 'appearance'>
    readonly expected: Pick<PreferencesExpected, 'general' | 'appearance'>
  }
  readonly extensions: { readonly source: OnboardingExtensionSource; readonly enabled?: boolean }
  readonly metadataProfiles: MetadataProfileCreate & { readonly isDefault: boolean }
  readonly scanner: ScanConfigCreate
  readonly showcase: ShowcaseFields
}

export interface OnboardingItemInput<G extends OnboardingGroup> {
  readonly itemId: string
  readonly expectedHandled: OnboardingHandled | null
  readonly input: OnboardingInputMap[G]
}

/** Preferences accepts exactly one item; other groups accept a nonempty selection. */
export type OnboardingApplyInput = {
  [G in OnboardingGroup]: {
    readonly group: G
    readonly items: G extends 'preferences'
      ? readonly [OnboardingItemInput<G>]
      : NonEmptyArray<OnboardingItemInput<G>>
  }
}[OnboardingGroup]

/** Safe failure summary attributed to installation, commit or runtime activation. */
export interface OnboardingIssue {
  readonly stage: 'installation' | 'commit' | 'runtime'
  readonly error: ErrorSummary
}

/** One item's application outcome, retained resources and stage-specific issues. */
export interface OnboardingItemResult<G extends OnboardingGroup = OnboardingGroup> {
  readonly itemId: string
  readonly outcome: 'applied' | 'notApplied' | 'notStarted'
  readonly resources: readonly OnboardingResourceRef<G>[]
  readonly issues: readonly OnboardingIssue[]
}

/**
 * Same-database groups commit atomically. Extension installation can remain durable even when its
 * handling record was not committed.
 */
export type OnboardingApplyResult<G extends OnboardingGroup = OnboardingGroup> = {
  [K in G]: {
    readonly group: K
    readonly items: readonly OnboardingItemResult<K>[]
  }
}[G]

/** Explicit recommendation selection with the handling baselines required to mark it skipped. */
export interface OnboardingSkipInput {
  readonly items: NonEmptyArray<{
    readonly itemId: string
    readonly expectedHandled: OnboardingHandled | null
  }>
}

export interface OnboardingApi {
  /** Reads saved presentation and handling state without changing it. */
  getState(call?: CallOptions): Promise<OnboardingState>

  /** Reads recommendations applicable to the requested mode and their actual handling state. */
  listItems(
    input: { readonly mode: OnboardingMode },
    call?: CallOptions,
  ): Promise<readonly OnboardingItem[]>

  /** Records a guide presentation after it has actually been shown. */
  markPresented(
    input: { readonly mode: OnboardingMode; readonly version: string },
    call?: CallOptions,
  ): Promise<OnboardingState>

  /**
   * Compares handling and business baselines before adopting the selected recommendations.
   *
   * Same-database groups commit together. Sequential extension installations preserve established
   * outcomes when later work fails.
   */
  apply<I extends OnboardingApplyInput>(
    input: I,
    call?: CallOptions,
  ): Promise<OnboardingApplyResult<I['group']>>

  /**
   * Marks selected unhandled recommendations as skipped after comparing their baselines.
   *
   * Already handled outcomes and timestamps remain unchanged when their baselines match. Skipping
   * leaves accepted work running.
   */
  skip(
    input: OnboardingSkipInput,
    call?: CallOptions,
  ): Promise<readonly { readonly itemId: string; readonly handled: OnboardingHandled }[]>

  /**
   * Finishes the guide presentation and records first completion when applicable.
   *
   * Closing the guide leaves unfinished items in their recorded state.
   */
  complete(input: { readonly mode: OnboardingMode }, call?: CallOptions): Promise<OnboardingState>

  /** Draft inputs remain owned by their editor. */
  onInvalidated(listener: () => void): Disposable
}

const version = fromParser((value) =>
  parseExternalValue(parseVersion, value, 'Invalid onboarding version'),
)

const extensionId = fromParser((value) =>
  parseExternalValue(parseId, value, 'Invalid extension identity'),
)

const resource = v.variant('type', [
  v.strictObject({ type: v.literal('extension'), extensionId }),
  v.strictObject({ type: v.literal('metadataProfile'), profileId: id }),
  v.strictObject({ type: v.literal('scanConfig'), configId: id }),
  v.strictObject({ type: v.literal('showcaseSection'), sectionId: id }),
])

const resources = v.pipe(
  v.array(resource),
  v.check((values) => unique(values, (value) => JSON.stringify(value))),
)

const handled = v.variant('outcome', [
  v.strictObject({ outcome: v.literal('skipped'), handledAt: timestamp }),
  v.strictObject({ outcome: v.literal('applied'), handledAt: timestamp, resources }),
])

const expectedHandled = v.nullable(handled)

const issue = v.strictObject({
  stage: v.picklist(['installation', 'commit', 'runtime']),
  error: fromParser(parseErrorSummary),
})

/** Parses an established applied or skipped outcome with its timestamp and resource references. */
export function parseOnboardingHandled(input: unknown): OnboardingHandled {
  return parseValue(handled, input, 'Invalid onboarding handled result')
}

/**
 * Parses saved presentation and handling state while preserving every valid catalog key.
 *
 * Keys matching Object.prototype names remain ordinary own properties.
 */
export function parseOnboardingState(input: unknown): OnboardingState {
  return parseValue(
    v.strictObject({
      firstPresentedAt: v.nullable(timestamp),
      firstCompletedAt: v.nullable(timestamp),
      lastPresentedVersion: v.nullable(fromParser(parseApplicationVersion)),
      handled: fromParser((value) => parseDictionary(id, handled, value)),
    }),
    input,
    'Invalid onboarding state',
  )
}

function parsePreferenceInput(input: unknown): OnboardingInputMap['preferences'] {
  const groups = v.strictObject({
    general: v.exactOptional(v.unknown()),
    appearance: v.exactOptional(v.unknown()),
  })
  const raw = parseValue(
    v.strictObject({ changes: groups, expected: groups }),
    input,
    'Invalid onboarding preference scope',
  )
  const value = parsePreferencesUpdate(raw)
  const baseline = value.expected!
  for (const key of ['general', 'appearance'] as const) {
    const changed = Object.keys(value.changes[key] ?? {})
    if (changed.length !== Object.keys(baseline[key] ?? {}).length) {
      throw new DesktopError(
        'InvalidInput',
        'Onboarding preferences require a baseline for every submitted field',
      )
    }
  }

  return { changes: value.changes, expected: baseline }
}

function parseExtensionInput(input: unknown): OnboardingInputMap['extensions'] {
  const prepared = fromParser((raw): OnboardingExtensionSource => {
    const value = parseRecord(raw)
    if (value.type !== 'newRepository') {
      return parseExtensionPackageSource(raw)
    }

    return parseValue(
      v.strictObject({
        type: v.literal('newRepository'),
        repository: v.pipe(v.unknown(), v.transform(parseExtensionRepositoryInput)),
        extensionId,
        version,
        sha256: v.pipe(text, v.regex(/^[a-f0-9]{64}$/)),
      }),
      raw,
      'Invalid confirmed onboarding repository source',
    )
  })
  return parseValue(
    v.strictObject({ source: prepared, enabled: v.exactOptional(v.boolean()) }),
    input,
    'Invalid onboarding extension input',
  )
}

function parseProfileInput(input: unknown): OnboardingInputMap['metadataProfiles'] {
  const value = parseMetadataProfileCreate(input)
  if (value.isDefault === undefined || (value.isDefault && !value.expected)) {
    throw new DesktopError(
      'InvalidInput',
      'Onboarding profiles require an explicit default choice and its applicable baseline',
    )
  }

  return { ...value, isDefault: value.isDefault }
}

const inputParsers = {
  preferences: parsePreferenceInput,
  extensions: parseExtensionInput,
  metadataProfiles: parseProfileInput,
  scanner: parseScanConfigCreate,
  showcase: parseShowcaseFields,
}

/**
 * Enforces unique item IDs, one preferences item and at most one new default profile per entry
 * kind. Callers run scanner regex validation in its normal bounded, terminable validation unit.
 */
export function parseOnboardingApplyInput(input: unknown): OnboardingApplyInput {
  const record = parseRecord(input)
  const group = parseValue(v.picklist(onboardingGroups), record.group)
  const parseInput: (input: unknown) => OnboardingInputMap[OnboardingGroup] = inputParsers[group]

  const item = v.strictObject({
    itemId: id,
    expectedHandled,
    input: fromParser(parseInput),
  })
  const value = parseValue(
    v.strictObject({
      group: v.literal(group),
      items: v.pipe(
        v.tupleWithRest([item], item),
        v.check((items) => unique(items, (item) => item.itemId)),
      ),
    }),
    input,
    'Invalid onboarding apply input',
  ) as OnboardingApplyInput

  if (value.group === 'preferences' && value.items.length !== 1) {
    throw new DesktopError('InvalidInput', 'Onboarding preferences apply one item')
  }
  if (
    value.group === 'metadataProfiles' &&
    !unique(
      value.items.filter((item) => item.input.isDefault),
      (item) => item.input.entryType,
    )
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Only one profile per type can become default in one apply',
    )
  }

  return value
}

/** Checks that every submitted item belongs to the requested group in the native catalog. */
export function validateOnboardingItemGroups(
  input: OnboardingApplyInput,
  catalog: readonly Pick<OnboardingItem, 'itemId' | 'group'>[],
): void {
  const groups = new Map(catalog.map((item) => [item.itemId, item.group]))
  if (input.items.some((item) => groups.get(item.itemId) !== input.group)) {
    throw new DesktopError(
      'InvalidInput',
      'Onboarding item does not belong to the requested catalog group',
    )
  }
}

/** Parses distinct recommendation IDs and their complete handling baselines. */
export function parseOnboardingSkipInput(input: unknown): OnboardingSkipInput {
  const item = v.strictObject({ itemId: id, expectedHandled })
  return parseValue(
    v.strictObject({
      items: v.pipe(
        v.tupleWithRest([item], item),
        v.check((items) => unique(items, (item) => item.itemId)),
      ),
    }),
    input,
    'Invalid onboarding skip input',
  )
}

/**
 * Only extension reports may retain a durable resource for an item whose handling did not commit.
 */
export function parseOnboardingApplyResult(input: unknown): OnboardingApplyResult {
  const value = parseValue(
    v.strictObject({
      group: v.picklist(onboardingGroups),
      items: v.pipe(
        v.array(
          v.strictObject({
            itemId: id,
            outcome: v.picklist(['applied', 'notApplied', 'notStarted']),
            resources,
            issues: v.array(issue),
          }),
        ),
        v.check((items) => unique(items, (item) => item.itemId)),
      ),
    }),
    input,
    'Invalid onboarding apply report',
  )

  const allowed = {
    preferences: null,
    extensions: 'extension',
    metadataProfiles: 'metadataProfile',
    scanner: 'scanConfig',
    showcase: 'showcaseSection',
  } as const
  for (const item of value.items) {
    if (
      item.resources.some((resource) => resource.type !== allowed[value.group]) ||
      item.resources.length > 1 ||
      (item.outcome === 'notStarted' && (item.resources.length > 0 || item.issues.length > 0))
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Onboarding resources do not match the actual group outcome',
      )
    }
    if (
      item.outcome === 'applied' &&
      value.group !== 'preferences' &&
      item.resources.length !== 1
    ) {
      throw new DesktopError('InvalidInput', 'An applied item requires its real created resource')
    }
    if (item.outcome !== 'applied' && value.group !== 'extensions' && item.resources.length > 0) {
      throw new DesktopError('InvalidInput', 'A failed database group cannot report new resources')
    }
  }
  if (
    value.group !== 'extensions' &&
    value.items.some((item) => item.outcome === 'applied') &&
    value.items.some((item) => item.outcome !== 'applied')
  ) {
    throw new DesktopError('InvalidInput', 'Same-database onboarding apply is atomic')
  }

  return value as OnboardingApplyResult
}
