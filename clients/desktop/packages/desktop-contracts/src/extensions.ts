/** @fileoverview Composes extension inventory, repositories, adoption and update operations. */

import type {
  ExtensionTarget,
  CompatibilityIssue,
} from '@kisaki3/extension-distribution/compatibility'
import type { ErrorSummary } from './errors'
import type { ExtensionManifest } from '@kisaki3/extension-distribution/manifest'
import type { RegistryDocument } from '@kisaki3/extension-distribution/registry'
import type { CallOptions, Disposable, Listener } from './operations'
import * as v from 'valibot'
import {
  parseExternalValue,
  text,
  id,
  parseValue,
  unique,
  optionalFields,
  validateExpectedKeys,
  timestamp,
} from './validation'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseVersion, normalizeTargets } from '@kisaki3/extension-distribution/compatibility'
import { parseErrorSummary, DesktopError } from './errors'
import { parsePublicKey, normalizeRegistry } from '@kisaki3/extension-distribution/registry'
import { parseAbsolutePath } from './paths'
import { parseHttpUrl } from './network'
import { normalizeManifest } from '@kisaki3/extension-distribution/manifest'

/** An exact repository artifact or an explicitly selected local package file. */
export type ExtensionPackageSource =
  | {
      readonly type: 'repository'
      readonly repositoryId: string
      readonly extensionId: string
      readonly version: string
      readonly sha256: string
    }
  | { readonly type: 'file'; readonly path: string }

/**
 * The source retained with a prepared package.
 *
 * Repository sources include the exact trust identity used to acquire the bytes.
 */
export type PreparedExtensionSource =
  | (Extract<ExtensionPackageSource, { type: 'repository' }> & {
      readonly declaredId: string
      readonly trustedPublicKey: string
    })
  | Extract<ExtensionPackageSource, { type: 'file' }>

/** An extension artifact's version, complete-byte digest and supported target set. */
export interface ExtensionArtifactIdentity {
  readonly extensionId: string
  readonly version: string
  readonly sha256: string
  readonly targets: readonly ExtensionTarget[]
}

/** A prepared artifact and the source identity retained for adoption checks. */
export interface PreparedExtensionUpdate extends ExtensionArtifactIdentity {
  readonly source: PreparedExtensionSource
}

/** A selected repository artifact that is available for update preparation. */
export interface ExtensionUpdateCandidate extends ExtensionArtifactIdentity {
  readonly source: Extract<ExtensionPackageSource, { type: 'repository' }>
}

/** Availability and validation status of the installed package bytes. */
export type ExtensionPackageState =
  | { readonly status: 'available' | 'missing' }
  | { readonly status: 'invalid'; readonly error: ErrorSummary }

/** The package's compatibility assessment, including unavailable or unmet conditions. */
export type ExtensionCompatibility =
  | { readonly status: 'compatible' | 'unavailable' }
  | { readonly status: 'incompatible'; readonly issues: readonly CompatibilityIssue[] }

/**
 * Installed extension identity, saved choices, prepared replacement and package assessment.
 *
 * Package availability, enabled intent, prepared updates and compatibility remain separate facts.
 */
export interface InstalledExtensionSummary {
  readonly id: string
  readonly version: string

  readonly enabled: boolean
  readonly updateRepositoryId: string | null
  readonly allowPrerelease: boolean

  readonly preparedUpdate: PreparedExtensionUpdate | null

  readonly packageState: ExtensionPackageState
  readonly compatibility: ExtensionCompatibility
}

/** An installed extension summary with its manifest when valid package bytes are available. */
export interface InstalledExtension extends InstalledExtensionSummary {
  readonly manifest: ExtensionManifest | null
}

/**
 * One extension's current activation phase or activation failure.
 *
 * Business failures do not change activation. Activation failures preserve saved enabled intent.
 */
export type ExtensionActivation =
  | { readonly status: 'inactive' | 'activating' | 'active' | 'deactivating' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }

/** Current activation state for one extension identity. */
export interface ExtensionState {
  readonly extensionId: string
  readonly activation: ExtensionActivation
}

/** The shared extension host's current process-lifecycle state. */
export type ExtensionRuntimeState =
  | { readonly status: 'stopped' | 'starting' | 'running' | 'stopping' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }

/** A completed activation attempt, identifying the active instance or the actual failure. */
export type ExtensionActivationResult =
  | { readonly extensionId: string; readonly outcome: 'activated'; readonly instanceId: string }
  | { readonly extensionId: string; readonly outcome: 'failed'; readonly error: ErrorSummary }

/**
 * Committed installation facts and the separate activation outcome.
 *
 * Installation can be durable when activation fails. The complete receipt is also valid as a failed
 * call's partialResult.
 */
export interface ExtensionInstallResult {
  readonly extension: InstalledExtensionSummary
  readonly activation: ExtensionActivation
}

/** The actual adoption outcome for one exact extension artifact. */
export type ExtensionAdoptionResult = {
  readonly extensionId: string
  readonly version: string
  readonly sha256: string
} & ({ readonly outcome: 'adopted' } | { readonly outcome: 'error'; readonly error: ErrorSummary })

/**
 * Known artifact-adoption and activation outcomes from a shared-host rebuild.
 *
 * On interruption, absent items have no reported outcome. Activation attempts may include
 * extensions outside the update batch.
 */
export interface ExtensionApplyUpdatesResult {
  readonly adopted: readonly ExtensionAdoptionResult[]
  readonly activations: readonly ExtensionActivationResult[]
}

/** An update-check failure scoped to a repository or extension. */
export type ExtensionUpdateIssue =
  | { readonly repositoryId: string; readonly error: ErrorSummary }
  | { readonly extensionId: string; readonly error: ErrorSummary }

/** Selected update candidates and independently reported source or extension failures. */
export interface ExtensionCheckUpdatesResult {
  readonly updates: readonly ExtensionUpdateCandidate[]
  readonly issues: readonly ExtensionUpdateIssue[]
}

/**
 * User-confirmed repository address, declared identity and pinned public key.
 *
 * Remote declarations alone cannot replace the saved trust.
 */
export interface ExtensionRepositoryInput {
  readonly url: string
  readonly declaredId: string
  readonly trustedPublicKey: string
}

/** A saved repository trust binding with its local identity. */
export interface ExtensionRepository extends ExtensionRepositoryInput {
  readonly id: string
}

/** Repository configuration changes and optional expected values for those same fields. */
export interface ExtensionRepositoryUpdate {
  readonly changes: Partial<ExtensionRepositoryInput>
  readonly expected?: Partial<ExtensionRepositoryInput>
}

/**
 * A display projection of verified registry content with its fetch time and response URL.
 *
 * Signature verification uses the original JSON values before normalization and known-field
 * projection.
 */
export interface ExtensionRegistrySnapshot {
  readonly registry: RegistryDocument
  /** UTC milliseconds since the Unix epoch. */
  readonly fetchedAt: number
  readonly responseUrl: string
}

/** Saved repository trust, the last verified cache and the current refresh error. */
export interface ExtensionRepositoryState {
  readonly repository: ExtensionRepository
  readonly cached: ExtensionRegistrySnapshot | null
  readonly error: ErrorSummary | null
}

/**
 * Inspected registry identity and content presented before a trust decision.
 *
 * The native management flow requires explicit confirmation of the declared ID and public key.
 */
export interface ExtensionRepositoryInspection {
  readonly url: string
  readonly responseUrl: string
  readonly registry: RegistryDocument
}

/** Native repository inspection, explicit trust management and verified-cache access. */
export interface ExtensionRepositoriesApi {
  /**
   * Lists saved repository trust, verified cached snapshots and current errors as separate facts.
   */
  list(call?: CallOptions): Promise<readonly ExtensionRepositoryState[]>

  /**
   * Reads one repository and its last verified cache without network refresh.
   *
   * Returns null when the configured identity is absent.
   */
  get(repositoryId: string, call?: CallOptions): Promise<ExtensionRepositoryState | null>

  /** Fetches and inspects a registry's declared identity and key before trust is established. */
  inspect(url: string, call?: CallOptions): Promise<ExtensionRepositoryInspection>

  /** Saves the explicitly confirmed repository identity, address and pinned public key. */
  add(input: ExtensionRepositoryInput, call?: CallOptions): Promise<string>

  /**
   * Compares and saves the requested repository configuration changes.
   *
   * Trust changes follow the explicit native management flow.
   */
  update(repositoryId: string, input: ExtensionRepositoryUpdate, call?: CallOptions): Promise<void>

  /**
   * Removes the repository binding and revokes updates prepared through it.
   *
   * Installed packages, enabled choices and private data remain.
   */
  remove(repositoryId: string, call?: CallOptions): Promise<void>

  /**
   * Verifies fetched registry JSON against saved trust before replacing the cached snapshot.
   *
   * Failure preserves the last verified content.
   */
  refresh(repositoryId: string, call?: CallOptions): Promise<ExtensionRegistrySnapshot>

  /**
   * Subscribes to repository-state invalidation before the caller reads a snapshot.
   *
   * Notifications do not initiate registry refresh or package installation.
   */
  onInvalidated(listener: () => void): Disposable
}

/** Observation and explicit restart of the shared extension host. */
export interface ExtensionRuntimeApi {
  /** Reads actual shared-host state independently of installation and enabled intent. */
  getState(call?: CallOptions): Promise<ExtensionRuntimeState>

  /**
   * Delivers current shared-host state and subsequent changes.
   *
   * Disposal releases observation without changing the host lifecycle.
   */
  observe(listener: Listener<ExtensionRuntimeState>): Disposable

  /**
   * Rebuilds the shared host from committed versions and reports activation outcomes.
   *
   * Pending updates and old business calls are not replayed.
   */
  restart(
    call?: CallOptions,
  ): Promise<{ readonly activations: readonly ExtensionActivationResult[] }>
}

/**
 * Native extension installation, update, activation and repository management.
 *
 * SDK adapters expose self information and navigation separately from this management authority.
 */
export interface ExtensionsApi {
  readonly repositories: ExtensionRepositoriesApi
  readonly runtime: ExtensionRuntimeApi

  /**
   * Lists installed summaries with saved enabled intent and prepared updates.
   *
   * Those facts do not establish successful activation.
   */
  list(call?: CallOptions): Promise<readonly InstalledExtensionSummary[]>

  /**
   * Reads an installed extension and its available metadata, or null when it is absent.
   *
   * Missing or invalid package bytes are represented by a null manifest.
   */
  get(extensionId: string, call?: CallOptions): Promise<InstalledExtension | null>

  /** Reads activation state for an installed identity, or null when it is absent. */
  getState(extensionId: string, call?: CallOptions): Promise<ExtensionState | null>

  /**
   * Delivers current extension activation state and subsequent changes.
   *
   * Observation leaves installation and activation decisions unchanged.
   */
  observe(extensionId: string, listener: Listener<ExtensionState | null>): Disposable

  /**
   * Installs a new extension identity and reports installation and activation separately.
   *
   * Enabled defaults to true and requests activation. An installed identity requires the explicit
   * update flow.
   */
  install(
    source: ExtensionPackageSource,
    options?: { readonly enabled?: boolean },
    call?: CallOptions,
  ): Promise<ExtensionInstallResult>

  /**
   * Saves enabled intent and attempts activation under current compatibility.
   *
   * The returned state reports actual activation separately.
   */
  enable(extensionId: string, call?: CallOptions): Promise<ExtensionState>

  /**
   * Saves disabled intent and finishes the instance's owned cleanup.
   *
   * Installed code and private data remain.
   */
  disable(extensionId: string, call?: CallOptions): Promise<ExtensionState>

  /**
   * Ends the instance and removes its installed package.
   *
   * The explicit privateData choice controls private-data removal; adopted library facts remain.
   */
  uninstall(
    input: { readonly extensionId: string; readonly privateData: 'keep' | 'delete' },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Checks bound trusted sources under each extension's compatibility and prerelease policy.
   *
   * Source and extension failures remain reported alongside valid candidates.
   */
  checkUpdates(call?: CallOptions): Promise<ExtensionCheckUpdatesResult>

  /**
   * Downloads and verifies the selected package for later adoption.
   *
   * Preparation does not activate it. Failure preserves any previously valid prepared receipt.
   */
  prepareUpdate(
    extensionId: string,
    source: ExtensionPackageSource,
    call?: CallOptions,
  ): Promise<PreparedExtensionUpdate>

  /**
   * Adopts the exact supplied receipts in one shared-host rebuild.
   *
   * Returns actual per-package adoption and activation outcomes.
   */
  applyUpdates(
    updates: readonly PreparedExtensionUpdate[],
    call?: CallOptions,
  ): Promise<ExtensionApplyUpdatesResult>

  /**
   * Binds an installed extension to a configured repository, or clears that binding.
   *
   * Changing the source revokes updates prepared under the previous binding.
   */
  setUpdateSource(
    extensionId: string,
    repositoryId: string | null,
    call?: CallOptions,
  ): Promise<void>

  /** Saves the extension's prerelease update preference while preserving the installed version. */
  setAllowPrerelease(
    extensionId: string,
    allowPrerelease: boolean,
    call?: CallOptions,
  ): Promise<void>

  /**
   * Subscribes to installed-summary invalidation before the caller reads a snapshot.
   *
   * Runtime observation remains independently owned.
   */
  onInvalidated(listener: () => void): Disposable
}

const extensionId = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
)

const version = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseVersion, value, 'Invalid extension version')),
)

const sha256 = v.pipe(text, v.regex(/^[a-f0-9]{64}$/))

const targets = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(normalizeTargets, value, 'Invalid extension targets')),
)

const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))

const publicKey = v.pipe(
  v.unknown(),
  v.transform((value) =>
    parseExternalValue(parsePublicKey, value, 'Invalid repository public key'),
  ),
)

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

const url = v.pipe(v.unknown(), v.transform(parseHttpUrl))

const repositoryEntries = { url, declaredId: extensionId, trustedPublicKey: publicKey }

const repositorySource = {
  type: v.literal('repository'),
  repositoryId: id,
  extensionId,
  version,
  sha256,
}

const source = v.variant('type', [
  v.strictObject(repositorySource),
  v.strictObject({ type: v.literal('file'), path }),
])

const preparedSource = v.variant('type', [
  v.strictObject({ ...repositorySource, declaredId: extensionId, trustedPublicKey: publicKey }),
  v.strictObject({ type: v.literal('file'), path }),
])

const artifact = { extensionId, version, sha256, targets }

const activation = v.variant('status', [
  v.strictObject({ status: v.picklist(['inactive', 'activating', 'active', 'deactivating']) }),
  v.strictObject({ status: v.literal('failed'), error }),
])

const activationResult = v.variant('outcome', [
  v.strictObject({ extensionId, outcome: v.literal('activated'), instanceId: id }),
  v.strictObject({ extensionId, outcome: v.literal('failed'), error }),
])

const packageState = v.variant('status', [
  v.strictObject({ status: v.picklist(['available', 'missing']) }),
  v.strictObject({ status: v.literal('invalid'), error }),
])

const compatibilityIssue = v.pipe(
  v.strictObject({
    condition: v.picklist(['target', 'apiVersion', 'nodeVersion', 'electronVersion']),
    required: v.union([
      text,
      v.pipe(
        v.unknown(),
        v.transform((value) =>
          parseExternalValue(normalizeTargets, value, 'Invalid required targets'),
        ),
      ),
    ]),
    actual: v.exactOptional(text),
  }),
  v.transform((value): CompatibilityIssue => ({ ...value, actual: value.actual })),
)

const compatibility = v.variant('status', [
  v.strictObject({ status: v.picklist(['compatible', 'unavailable']) }),
  v.strictObject({
    status: v.literal('incompatible'),
    issues: v.pipe(v.array(compatibilityIssue), v.minLength(1)),
  }),
])

const summary = {
  id: extensionId,
  version,

  enabled: v.boolean(),
  updateRepositoryId: v.nullable(id),
  allowPrerelease: v.boolean(),

  preparedUpdate: v.nullable(v.pipe(v.unknown(), v.transform(parsePreparedExtensionUpdate))),

  packageState,
  compatibility,
}

/** Parses exact repository coordinates or an explicit absolute package-file path. */
export function parseExtensionPackageSource(input: unknown): ExtensionPackageSource {
  return parseValue(source, input, 'Invalid extension package source')
}

/** Parses an artifact's exact identity independently from acquisition or installation state. */
export function parseExtensionArtifactIdentity(input: unknown): ExtensionArtifactIdentity {
  return parseValue(v.strictObject(artifact), input, 'Invalid extension artifact identity')
}

/**
 * Parses a prepared receipt and checks that repository coordinates match its artifact.
 *
 * Adoption separately checks the actual bytes and current repository trust.
 */
export function parsePreparedExtensionUpdate(input: unknown): PreparedExtensionUpdate {
  const value = parseValue(
    v.strictObject({ ...artifact, source: preparedSource }),
    input,
    'Invalid prepared extension update',
  )
  if (
    value.source.type === 'repository' &&
    (value.source.extensionId !== value.extensionId ||
      value.source.version !== value.version ||
      value.source.sha256 !== value.sha256)
  ) {
    throw new DesktopError('InvalidInput', 'Prepared extension source does not match its artifact')
  }

  return value
}

/** Parses an update candidate and checks its exact repository artifact identity. */
export function parseExtensionUpdateCandidate(input: unknown): ExtensionUpdateCandidate {
  const value = parseValue(
    v.strictObject({ ...artifact, source: v.strictObject(repositorySource) }),
    input,
    'Invalid extension update candidate',
  )
  if (
    value.source.extensionId !== value.extensionId ||
    value.source.version !== value.version ||
    value.source.sha256 !== value.sha256
  ) {
    throw new DesktopError('InvalidInput', 'Extension candidate source does not match its artifact')
  }

  return value
}

/** Parses installed facts and checks that a prepared update belongs to the same extension. */
export function parseInstalledExtensionSummary(input: unknown): InstalledExtensionSummary {
  const value = parseValue(v.strictObject(summary), input, 'Invalid installed extension summary')
  if (value.preparedUpdate && value.preparedUpdate.extensionId !== value.id) {
    throw new DesktopError('InvalidInput', 'Prepared update belongs to another extension')
  }

  return value
}

/**
 * Parses installed details and checks manifest presence, identity and version against package
 * state.
 */
export function parseInstalledExtension(input: unknown): InstalledExtension {
  const value = parseValue(
    v.strictObject({
      ...summary,
      manifest: v.nullable(
        v.pipe(
          v.unknown(),
          v.transform((value) =>
            parseExternalValue(normalizeManifest, value, 'Invalid installed manifest'),
          ),
        ),
      ),
    }),
    input,
    'Invalid installed extension',
  )
  const { manifest, ...base } = value
  parseInstalledExtensionSummary(base)
  if (
    (value.packageState.status === 'available') !== (manifest !== null) ||
    (manifest && (manifest.id !== value.id || manifest.version !== value.version))
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Installed manifest does not match its package state or identity',
    )
  }

  return value
}

/** Parses an extension identity and its activation state. */
export function parseExtensionState(input: unknown): ExtensionState {
  return parseValue(v.strictObject({ extensionId, activation }), input, 'Invalid extension state')
}

/** Parses shared-host lifecycle state independently of individual extension activation. */
export function parseExtensionRuntimeState(input: unknown): ExtensionRuntimeState {
  return parseValue(
    v.variant('status', [
      v.strictObject({ status: v.picklist(['stopped', 'starting', 'running', 'stopping']) }),
      v.strictObject({ status: v.literal('failed'), error }),
    ]),
    input,
    'Invalid extension runtime state',
  )
}

/** Parses a successful instance identity or a failed activation's safe error. */
export function parseExtensionActivationResult(input: unknown): ExtensionActivationResult {
  return parseValue(activationResult, input, 'Invalid extension activation result')
}

/** Parses committed installation facts and the separate activation outcome. */
export function parseExtensionInstallResult(input: unknown): ExtensionInstallResult {
  return parseValue(
    v.strictObject({
      extension: v.pipe(v.unknown(), v.transform(parseInstalledExtensionSummary)),
      activation,
    }),
    input,
    'Invalid extension installation result',
  )
}

/**
 * Parses known adoption and activation outcomes with distinct extension identities in each list.
 */
export function parseExtensionApplyUpdatesResult(input: unknown): ExtensionApplyUpdatesResult {
  const adopted = v.variant('outcome', [
    v.strictObject({ extensionId, version, sha256, outcome: v.literal('adopted') }),
    v.strictObject({ extensionId, version, sha256, outcome: v.literal('error'), error }),
  ])
  return parseValue(
    v.strictObject({
      adopted: v.pipe(
        v.array(adopted),
        v.check((values) => unique(values, (value) => value.extensionId)),
      ),
      activations: v.pipe(
        v.array(activationResult),
        v.check((values) => unique(values, (value) => value.extensionId)),
      ),
    }),
    input,
    'Invalid extension update adoption report',
  )
}

/** Parses unique update candidates and repository or extension check failures. */
export function parseExtensionCheckUpdatesResult(input: unknown): ExtensionCheckUpdatesResult {
  return parseValue(
    v.strictObject({
      updates: v.pipe(
        v.array(v.pipe(v.unknown(), v.transform(parseExtensionUpdateCandidate))),
        v.check((values) => unique(values, (value) => value.extensionId)),
      ),
      issues: v.array(
        v.union([
          v.strictObject({ repositoryId: id, error }),
          v.strictObject({ extensionId, error }),
        ]),
      ),
    }),
    input,
    'Invalid extension update check report',
  )
}

/** Parses explicit repository URL, identity and key fields for a trust-management request. */
export function parseExtensionRepositoryInput(input: unknown): ExtensionRepositoryInput {
  return parseValue(
    v.strictObject(repositoryEntries),
    input,
    'Invalid extension repository trust input',
  )
}

/** Parses repository changes and restricts expected values to the changed fields. */
export function parseExtensionRepositoryUpdate(input: unknown): ExtensionRepositoryUpdate {
  const fields = v.strictObject(optionalFields(repositoryEntries))
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid extension repository update',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/**
 * Parses a registry display projection, fetch time and response URL.
 *
 * Authentication and trust decisions belong to the repository owner.
 */
export function parseExtensionRegistrySnapshot(input: unknown): ExtensionRegistrySnapshot {
  return parseValue(
    v.strictObject({
      registry: v.pipe(
        v.unknown(),
        v.transform((value) =>
          parseExternalValue(normalizeRegistry, value, 'Invalid registry projection'),
        ),
      ),
      fetchedAt: timestamp,
      responseUrl: url,
    }),
    input,
    'Invalid registry snapshot',
  )
}

export type { ExtensionManifest } from '@kisaki3/extension-distribution/manifest'

export type {
  CompatibilityIssue,
  ExtensionTarget,
} from '@kisaki3/extension-distribution/compatibility'
