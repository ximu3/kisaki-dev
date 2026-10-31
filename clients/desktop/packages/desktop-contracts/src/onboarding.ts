/** @fileoverview Defines native onboarding's actual handled facts and finite atomic business composition. */

import type { AppearancePreferences } from './appearance'
import type { ErrorSummary } from './errors'
import type { CallOptions, Disposable } from './execution'
import type { ExtensionPackageSource, ExtensionRepositoryFields } from './extensions'
import type { ShowcaseConfiguration, ShowcasePresetId } from './library/showcase'
import type { MetadataProfileCreate } from './metadata/profiles'
import type { GeneralPreferences } from './preferences'
import type { ScanConfigCreate } from './scanner/configs'

export type OnboardingGroup =
  'preferences' | 'extensions' | 'metadataProfiles' | 'scanner' | 'showcase'
export type OnboardingMode = 'firstUse' | 'update' | 'manual'
export type OnboardingResourceRef =
  | { readonly type: 'extension'; readonly extensionId: string }
  | { readonly type: 'metadataProfile'; readonly profileId: string }
  | { readonly type: 'scanConfig'; readonly configId: string }
  | { readonly type: 'showcaseSection'; readonly sectionId: string }
/** Applied records retain actual results even after those resources are later deleted or become unavailable. */
export type OnboardingHandled =
  | { readonly outcome: 'skipped'; readonly handledAt: number }
  | {
      readonly outcome: 'applied'
      readonly handledAt: number
      readonly resources: readonly OnboardingResourceRef[]
    }
/** Presentation and handling facts use UTC milliseconds and do not imply that adopted resources still exist. */
export interface OnboardingState {
  readonly firstPresentedAt: number | null
  readonly firstCompletedAt: number | null
  readonly lastPresentedVersion: string | null
  readonly handled: Readonly<Record<string, OnboardingHandled>>
}
/** A current recommendation combines its stable item identity with independent saved handling facts. */
export interface OnboardingCatalogItem {
  readonly itemId: string
  readonly group: OnboardingGroup
  readonly title: string
  readonly description: string
  readonly reference:
    | { readonly type: 'extension'; readonly extensionId: string }
    | { readonly type: 'metadataPreset'; readonly presetId: string }
    | { readonly type: 'showcasePreset'; readonly presetId: ShowcasePresetId }
    | null
  readonly handled: OnboardingHandled | null
}
/** Onboarding exposes only its selected preference groups; ordinary preference comparison rules still apply. */
export interface OnboardingPreferenceChanges {
  readonly general?: Partial<GeneralPreferences>
  readonly appearance?: Partial<AppearancePreferences>
}
/** Each onboarding group reuses the input owned by its actual business operation. */
export interface OnboardingInputByGroup {
  readonly preferences: {
    readonly changes: OnboardingPreferenceChanges
    readonly expected: OnboardingPreferenceChanges
  }
  readonly extensions: {
    readonly source: ExtensionPackageSource
    readonly repository?: ExtensionRepositoryFields
  }
  readonly metadataProfiles: MetadataProfileCreate & { readonly isDefault: boolean }
  readonly scanner: ScanConfigCreate
  readonly showcase: ShowcaseConfiguration & { readonly key: string }
}
type OnboardingApplyItem<Group extends OnboardingGroup> = {
  readonly itemId: string
  readonly expectedHandled: OnboardingHandled | null
  readonly input: OnboardingInputByGroup[Group]
}

/** Each item compares its handled and business baselines; preferences use one complete edit, other groups accept a nonempty batch. */
export type OnboardingApplyInput = {
  [Group in OnboardingGroup]: {
    readonly group: Group
    readonly items: Group extends 'preferences'
      ? readonly [OnboardingApplyItem<Group>]
      : readonly [OnboardingApplyItem<Group>, ...OnboardingApplyItem<Group>[]]
  }
}[OnboardingGroup]
/** Results report actual adoption and runtime issues separately; notStarted does not invent a failed attempt. */
export interface OnboardingApplyResult {
  readonly group: OnboardingGroup
  readonly items: readonly {
    readonly itemId: string
    readonly outcome: 'applied' | 'notApplied' | 'notStarted'
    readonly resources: readonly OnboardingResourceRef[]
    readonly issues: readonly {
      readonly stage: 'installation' | 'commit' | 'runtime'
      readonly error: ErrorSummary
    }[]
  }[]
}
/** Onboarding management belongs only to the native application; extensions can navigate to its UI. */
export interface OnboardingApi {
  /** Read handled facts without advancing presentation or adopting recommendations. */
  getState(call?: CallOptions): Promise<OnboardingState>
  /** Read applicable finite catalog entries and their current handled facts. */
  listItems(
    input: { readonly mode: OnboardingMode },
    call?: CallOptions,
  ): Promise<readonly OnboardingCatalogItem[]>
  /** Record actual presentation of this mode/version, without claiming completion or forcing later reopening. */
  markPresented(
    input: { readonly mode: OnboardingMode; readonly version: string },
    call?: CallOptions,
  ): Promise<OnboardingState>
  /** Atomically adopt one database group and its handled facts; extension installs commit sequentially and retain actual partial results. */
  apply(input: OnboardingApplyInput, call?: CallOptions): Promise<OnboardingApplyResult>
  /** Compare explicit handled baselines and mark only not-yet-applied items skipped; existing outcomes/times remain unchanged. */
  skip(
    input: {
      readonly items: readonly [
        { readonly itemId: string; readonly expectedHandled: OnboardingHandled | null },
        ...{ readonly itemId: string; readonly expectedHandled: OnboardingHandled | null }[],
      ]
    },
    call?: CallOptions,
  ): Promise<readonly { readonly itemId: string; readonly handled: OnboardingHandled }[]>
  /** End this guide and record first completion when appropriate, without finishing independent in-flight business. */
  complete(input: { readonly mode: OnboardingMode }, call?: CallOptions): Promise<OnboardingState>
  /** Notify that saved handled state changed; drafts remain owned by their editing flow. */
  onInvalidated(listener: () => void): Disposable
}
