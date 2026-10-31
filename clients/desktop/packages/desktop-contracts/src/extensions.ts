/** @fileoverview Defines native extension installation, pinned repository trust, prepared updates, and actual runtime management. */

import type { ExtensionCompatibility } from '@kisaki3/extension-distribution/compatibility'
import type { ExtensionManifest, ExtensionTarget } from '@kisaki3/extension-distribution/manifest'
import type { ExtensionRegistry } from '@kisaki3/extension-distribution/registry'
import type { ErrorSummary } from './errors'
import type { CallOptions, Disposable } from './execution'

/** Every source fixes actual bytes or an explicitly selected local package; no implicit latest selection occurs during adoption. */
export type ExtensionPackageSource =
  | {
      readonly type: 'repository'
      readonly repositoryId: string
      readonly extensionId: string
      readonly version: string
      readonly sha256: string
    }
  | { readonly type: 'file'; readonly path: string }
export type PreparedExtensionSource =
  | (Extract<ExtensionPackageSource, { type: 'repository' }> & {
      readonly declaredId: string
      readonly trustedPublicKey: string
    })
  | Extract<ExtensionPackageSource, { type: 'file' }>
export interface PreparedExtensionUpdate {
  readonly extensionId: string
  readonly version: string
  readonly sha256: string
  readonly targets: readonly ExtensionTarget[]
  readonly source: PreparedExtensionSource
}
/** Installation, enabled intent, compatibility, activation, and a prepared newer package remain independent facts. */
export interface InstalledExtensionSummary {
  readonly id: string
  readonly version: string
  readonly enabled: boolean
  readonly updateRepositoryId: string | null
  readonly allowPrerelease: boolean
  readonly preparedUpdate: PreparedExtensionUpdate | null
}
export type InstalledExtension = InstalledExtensionSummary & {
  readonly compatibility: ExtensionCompatibility
} & (
    | { readonly packageState: 'available'; readonly manifest: ExtensionManifest }
    | { readonly packageState: 'missing'; readonly manifest: null }
    | { readonly packageState: 'invalid'; readonly manifest: null; readonly error: ErrorSummary }
  )
export type ExtensionActivation =
  | { readonly status: 'inactive' | 'activating' | 'active' | 'deactivating' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }
export type ExtensionRuntimeState =
  | { readonly status: 'stopped' | 'starting' | 'running' | 'stopping' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }
export type ExtensionActivationResult =
  | { readonly extensionId: string; readonly instanceId: string; readonly outcome: 'activated' }
  | { readonly extensionId: string; readonly outcome: 'failed'; readonly error: ErrorSummary }
export interface ExtensionInstallResult {
  readonly installed: InstalledExtensionSummary
  readonly activation: ExtensionActivationResult
}
export interface ExtensionUpdateCheck {
  readonly updates: readonly {
    readonly extensionId: string
    readonly source: Extract<ExtensionPackageSource, { type: 'repository' }>
  }[]
  readonly issues: readonly (
    | { readonly repositoryId: string; readonly error: ErrorSummary }
    | { readonly extensionId: string; readonly error: ErrorSummary }
  )[]
}
export interface ExtensionUpdateResult {
  readonly adopted: readonly ({
    readonly extensionId: string
    readonly version: string
    readonly sha256: string
  } & (
    { readonly outcome: 'adopted' } | { readonly outcome: 'failed'; readonly error: ErrorSummary }
  ))[]
  readonly activations: readonly ExtensionActivationResult[]
}
export interface ExtensionRepositoryFields {
  readonly url: string
  readonly declaredId: string
  readonly trustedPublicKey: string
}
export interface ExtensionRepository extends ExtensionRepositoryFields {
  readonly id: string
  readonly cached: ExtensionRepositorySnapshot | null
}
/** A verified response retains its own URL base and verification time; refresh failure does not erase it. */
export interface ExtensionRepositorySnapshot {
  readonly registry: ExtensionRegistry
  readonly fetchedAt: number
  readonly responseUrl: string
}
export interface ExtensionRepositoriesApi {
  /** Read local identities and last verified management snapshots. */
  list(call?: CallOptions): Promise<readonly ExtensionRepository[]>
  /** Read one local repository or null without establishing new trust. */
  get(repositoryId: string, call?: CallOptions): Promise<ExtensionRepository | null>
  /** Inspect untrusted remote identity/key for explicit user confirmation; this does not save or trust it. */
  inspect(url: string, call?: CallOptions): Promise<ExtensionRepositorySnapshot>
  /** Save an explicitly confirmed remote identity and key, returning a new independent local identity. */
  add(input: ExtensionRepositoryFields, call?: CallOptions): Promise<string>
  /** Compare related fields and apply the explicit trust/address choice, revoking incompatible prepared sources. */
  update(
    repositoryId: string,
    input: {
      readonly changes: Partial<ExtensionRepositoryFields>
      readonly expected?: Partial<ExtensionRepositoryFields>
    },
    call?: CallOptions,
  ): Promise<void>
  /** Remove local trust and bindings, retaining installed packages, enabled intent, and private data. */
  remove(repositoryId: string, call?: CallOptions): Promise<void>
  /** Verify against the saved identity/key, then replace the cache; failure retains the previous verified response. */
  refresh(repositoryId: string, call?: CallOptions): Promise<ExtensionRepositorySnapshot>
  /** Notify consumers to reread local repository state. */
  onInvalidated(listener: () => void): Disposable
}
/** These native management operations are deliberately excluded from the extension Node API. */
export interface ExtensionsApi {
  readonly repositories: ExtensionRepositoriesApi
  readonly runtime: {
    /** Read the actual shared host state, independently of any one extension's activation. */
    getState(call?: CallOptions): Promise<ExtensionRuntimeState>
    /** Deliver initial state then ordered changes without a read gap. */
    observe(listener: (state: ExtensionRuntimeState) => void): Disposable
    /** Confirm affected views, rebuild the shared host using current versions, and await actual activation attempts. */
    restart(
      call?: CallOptions,
    ): Promise<{ readonly activations: readonly ExtensionActivationResult[] }>
  }
  /** Read installed summaries, retaining prepared versions separately from active installation facts. */
  list(call?: CallOptions): Promise<readonly InstalledExtensionSummary[]>
  /** Read an installation and actual manifest availability, or null. */
  get(extensionId: string, call?: CallOptions): Promise<InstalledExtension | null>
  /** Read an installed extension's actual activation or null; provider failures never change enabled intent. */
  getState(extensionId: string, call?: CallOptions): Promise<ExtensionActivation | null>
  /** Deliver current activation then changes; final null ends observation. */
  observe(extensionId: string, listener: (state: ExtensionActivation | null) => void): Disposable
  /** Install a new identity, save enabled intent, and activate; activation failure retains an actual installed partial result. */
  install(source: ExtensionPackageSource, call?: CallOptions): Promise<ExtensionInstallResult>
  /** Save enabled intent and await this actual activation attempt. */
  enable(extensionId: string, call?: CallOptions): Promise<ExtensionActivation>
  /** Confirm views before revoking calls, then stop the actual instance and await its cleanup. */
  disable(extensionId: string, call?: CallOptions): Promise<ExtensionActivation>
  /** Remove the actual installation and handle private data only according to the explicit choice. */
  uninstall(
    input: { readonly extensionId: string; readonly privateData: 'keep' | 'delete' },
    call?: CallOptions,
  ): Promise<void>
  /** Check bound sources without downloading and retain independent source issues. */
  checkUpdates(call?: CallOptions): Promise<ExtensionUpdateCheck>
  /** Prepare exact validated bytes; failed new preparation retains any previous prepared update. */
  prepareUpdate(
    extensionId: string,
    source: ExtensionPackageSource,
    call?: CallOptions,
  ): Promise<PreparedExtensionUpdate>
  /** Adopt only the actual selected preparation values during one shared rebuild, reporting adoption and activation separately. */
  applyUpdates(
    preparedUpdates: readonly [PreparedExtensionUpdate, ...PreparedExtensionUpdate[]],
    call?: CallOptions,
  ): Promise<ExtensionUpdateResult>
  /** Change this installation's explicit update binding, invalidating preparation tied to the old source. */
  setUpdateSource(
    extensionId: string,
    repositoryId: string | null,
    call?: CallOptions,
  ): Promise<void>
  /** Save only this extension's prerelease policy; manual installation does not infer that preference. */
  setAllowPrerelease(
    extensionId: string,
    allowPrerelease: boolean,
    call?: CallOptions,
  ): Promise<void>
  /** Notify consumers of installed/prepared facts, independently of high-frequency runtime observation. */
  onInvalidated(listener: () => void): Disposable
}
