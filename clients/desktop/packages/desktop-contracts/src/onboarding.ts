/** @fileoverview Defines native recommendation handling as explicit business inputs and durable per-item outcomes, never persistent drafts. */

import type { ExtensionPackageSource, ExtensionRepositoryInput } from './extensions'
import type { PreferencesChanges, PreferencesExpected } from './preferences/api'
import type { MetadataProfileCreate } from './metadata/profiles'
import type { ScanConfigCreate } from './scanner/configs'
import type { ShowcaseFields } from './library/showcase'
import type { NonEmptyArray, CallOptions, Disposable } from './operations'
import type { ErrorSummary } from './errors'
import * as v from 'valibot'
import {
  parseExternalValue,
  id,
  unique,
  timestamp,
  parseValue,
  parseDictionary,
  readRecord,
  text,
} from './validation'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseErrorSummary, DesktopError } from './errors'
import { parsePreferencesUpdate } from './preferences/api'
import { parseExtensionPackageSource, parseExtensionRepositoryInput } from './extensions'
import { parseMetadataProfileCreate } from './metadata/profiles'
import { parseScanConfigCreate } from './scanner/configs'
import { parseShowcaseFields, parseShowcaseChanges } from './library/showcase'
import { parseApplicationVersion } from './app'

export const onboardingGroups = Object.freeze([
  'preferences',
  'extensions',
  'metadataProfiles',
  'scanner',
  'showcase',
] as const)

export type OnboardingGroup = (typeof onboardingGroups)[number]

export type OnboardingMode = 'firstUse' | 'update' | 'manual'

export type OnboardingResourceRef =
  | { readonly type: 'extension'; readonly extensionId: string }
  | { readonly type: 'metadataProfile'; readonly profileId: string }
  | { readonly type: 'scanConfig'; readonly configId: string }
  | { readonly type: 'showcaseSection'; readonly sectionId: string }

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

/** handled keys are stable native catalog identities; deleted/unavailable resources do not erase these historical outcomes. */
export interface OnboardingState {
  /** UTC milliseconds since the Unix epoch; null until the guide is actually presented. */
  readonly firstPresentedAt: number | null
  /** UTC milliseconds since the Unix epoch; null until first-use guidance is completed. */
  readonly firstCompletedAt: number | null
  readonly lastPresentedVersion: string | null
  readonly handled: Readonly<Record<string, OnboardingHandled>>
}

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

/** Explicit confirmation can add a repository before installing its fixed artifact. Existing repositories use their real local ID. */
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
  readonly showcase: { readonly key: string; readonly data: ShowcaseFields }
}

export interface OnboardingItemInput<G extends OnboardingGroup> {
  readonly itemId: string
  readonly expectedHandled: OnboardingHandled | null
  readonly input: OnboardingInputMap[G]
}

/** One preferences item; other groups can apply a nonempty ordered selection. No input accepts a script or generic transaction. */
export type OnboardingApplyInput = {
  [G in OnboardingGroup]: {
    readonly group: G
    readonly items: G extends 'preferences'
      ? readonly [OnboardingItemInput<G>]
      : NonEmptyArray<OnboardingItemInput<G>>
  }
}[OnboardingGroup]

export interface OnboardingIssue {
  readonly stage: 'installation' | 'commit' | 'runtime'
  readonly error: ErrorSummary
}

export interface OnboardingItemResult {
  readonly itemId: string
  readonly outcome: 'applied' | 'notApplied' | 'notStarted'
  readonly resources: readonly OnboardingResourceRef[]
  readonly issues: readonly OnboardingIssue[]
}

/** A same-database failure rolls back all new resources. An extension failure can retain a committed install even without handled. */
export interface OnboardingApplyResult<G extends OnboardingGroup = OnboardingGroup> {
  readonly group: G
  readonly items: readonly OnboardingItemResult[]
}

export interface OnboardingSkipInput {
  readonly items: NonEmptyArray<{
    readonly itemId: string
    readonly expectedHandled: OnboardingHandled | null
  }>
}

export interface OnboardingApi {
  /**
   * Read formal presentation and handling state without marking the guide as shown or completing
   * recommendations.
   */
  getState(call?: CallOptions): Promise<OnboardingState>

  /**
   * Read applicable recommendations and their actual handling/resource state for the requested
   * mode; querying does not apply them.
   */
  listItems(
    input: { readonly mode: OnboardingMode },
    call?: CallOptions,
  ): Promise<readonly OnboardingItem[]>

  /** Record only after actual presentation; reading state never marks it as shown. */
  markPresented(
    input: { readonly mode: OnboardingMode; readonly version: string },
    call?: CallOptions,
  ): Promise<OnboardingState>

  /**
   * Compare handling and business baselines before adoption; same-database groups commit
   * together, while sequential extension installs preserve established outcomes on later
   * failure.
   */
  apply<I extends OnboardingApplyInput>(
    input: I,
    call?: CallOptions,
  ): Promise<OnboardingApplyResult<I['group']>>

  /** Preserve already handled outcomes/times when their explicit baseline still matches; never cancel accepted work. */
  skip(
    input: OnboardingSkipInput,
    call?: CallOptions,
  ): Promise<readonly { readonly itemId: string; readonly handled: OnboardingHandled }[]>

  /**
   * Finish this guide presentation and record first completion when applicable; unfinished
   * business is not marked successful.
   */
  complete(input: { readonly mode: OnboardingMode }, call?: CallOptions): Promise<OnboardingState>

  /**
   * Subscribe to formal onboarding-state changes; notifications never contain or commit the
   * editor's unsaved inputs.
   */
  onInvalidated(listener: () => void): Disposable
}

const version = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseVersion, value, 'Invalid onboarding version')),
)

const extensionId = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
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
  error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
})

/** Validate one established applied/skipped outcome with its timestamp and actual resource references. */
export function parseOnboardingHandled(input: unknown): OnboardingHandled {
  return parseValue(handled, input, 'Invalid onboarding handled result')
}

/** Keep every valid item key, including names normally inherited from Object.prototype. */
export function parseOnboardingState(input: unknown): OnboardingState {
  return parseValue(
    v.strictObject({
      firstPresentedAt: v.nullable(timestamp),
      firstCompletedAt: v.nullable(timestamp),
      lastPresentedVersion: v.nullable(v.pipe(v.unknown(), v.transform(parseApplicationVersion))),
      handled: v.pipe(
        v.unknown(),
        v.transform((value) => parseDictionary(id, handled, value)),
      ),
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
  const prepared = v.pipe(
    v.unknown(),
    v.transform((raw): OnboardingExtensionSource => {
      const value = readRecord(raw)
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
    }),
  )
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
  showcase: (input: unknown) =>
    parseValue(
      v.strictObject({ key: id, data: v.pipe(v.unknown(), v.transform(parseShowcaseFields)) }),
      input,
      'Invalid onboarding showcase creation',
    ),
}

/** Reuse each owner's complete input. Scanner regex validation must run inside its normal bounded terminable validation unit. */
export function parseOnboardingApplyInput(input: unknown): OnboardingApplyInput {
  const record = readRecord(input)
  const group = parseValue(v.picklist(onboardingGroups), record.group)
  const parseInput: (input: unknown) => OnboardingInputMap[OnboardingGroup] = inputParsers[group]

  const item = v.strictObject({
    itemId: id,
    expectedHandled,
    input: v.pipe(v.unknown(), v.transform(parseInput)),
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
  if (value.group === 'showcase') {
    parseShowcaseChanges({ create: value.items.map((item) => item.input) })
  }

  return value
}

/** The real native catalog determines group membership; missing or cross-group item IDs cannot expand the operation. */
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

/** Require distinct explicit recommendation identities and their complete handling baselines before skipping. */
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

/** Reject invented resources and partial same-database commits; installation reports alone may retain an unmarked durable package. */
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

  return value
}
