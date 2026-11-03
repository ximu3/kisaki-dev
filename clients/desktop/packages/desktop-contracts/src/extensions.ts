/** @fileoverview Defines native extension installation, explicit repository trust and independent shared-host runtime facts. */

import * as v from 'valibot'
import { normalizeTargets, parseVersion } from '@kisaki3/extension-distribution/compatibility'
import type {
  CompatibilityIssue,
  ExtensionTarget,
} from '@kisaki3/extension-distribution/compatibility'
import { normalizeManifest } from '@kisaki3/extension-distribution/manifest'
import type { ExtensionManifest } from '@kisaki3/extension-distribution/manifest'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { normalizeRegistry, parsePublicKey } from '@kisaki3/extension-distribution/registry'
import type { RegistryDocument } from '@kisaki3/extension-distribution/registry'
import { DesktopError, parseErrorSummary } from './errors'
import type { ErrorSummary } from './errors'
import { parseHttpUrl } from './network'
import type { CallOptions, Disposable, Listener } from './operations'
import { parseAbsolutePath } from './paths'
import {
  id,
  optionalFields,
  parseExternalValue,
  parseValue,
  text,
  timestamp,
  unique,
  validateExpectedKeys,
} from './validation'

export type { ExtensionManifest } from '@kisaki3/extension-distribution/manifest'
export type {
  CompatibilityIssue,
  ExtensionTarget,
} from '@kisaki3/extension-distribution/compatibility'

export type ExtensionPackageSource =
  | {
      readonly type: 'repository'
      readonly repositoryId: string
      readonly extensionId: string
      readonly version: string
      readonly sha256: string
    }
  | { readonly type: 'file'; readonly path: string }

/** A verified prepared repository source retains the exact trust identity used to acquire those bytes. */
export type PreparedExtensionSource =
  | (Extract<ExtensionPackageSource, { type: 'repository' }> & {
      readonly declaredId: string
      readonly trustedPublicKey: string
    })
  | Extract<ExtensionPackageSource, { type: 'file' }>

export interface ExtensionArtifactIdentity {
  readonly extensionId: string
  readonly version: string
  readonly sha256: string
  readonly targets: readonly ExtensionTarget[]
}

export interface PreparedExtensionUpdate extends ExtensionArtifactIdentity {
  readonly source: PreparedExtensionSource
}

export interface ExtensionUpdateCandidate extends ExtensionArtifactIdentity {
  readonly source: Extract<ExtensionPackageSource, { type: 'repository' }>
}

export type ExtensionPackageState =
  | { readonly status: 'available' | 'missing' }
  | { readonly status: 'invalid'; readonly error: ErrorSummary }

export type ExtensionCompatibility =
  | { readonly status: 'compatible' | 'unavailable' }
  | { readonly status: 'incompatible'; readonly issues: readonly CompatibilityIssue[] }

/** Installed package, enabled intent, prepared replacement and compatibility are independent persisted/read facts. */
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

export interface InstalledExtension extends InstalledExtensionSummary {
  readonly manifest: ExtensionManifest | null
}

/** Business/provider failures do not change activation, and activation failures do not silently clear enabled intent. */
export type ExtensionActivation =
  | { readonly status: 'inactive' | 'activating' | 'active' | 'deactivating' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }

export interface ExtensionState {
  readonly extensionId: string
  readonly activation: ExtensionActivation
}

export type ExtensionRuntimeState =
  | { readonly status: 'stopped' | 'starting' | 'running' | 'stopping' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }

export type ExtensionActivationResult =
  | { readonly extensionId: string; readonly outcome: 'activated'; readonly instanceId: string }
  | { readonly extensionId: string; readonly outcome: 'failed'; readonly error: ErrorSummary }

/** Installation can be durable even when activation fails; the same complete receipt is legal as a partialResult. */
export interface ExtensionInstallResult {
  readonly extension: InstalledExtensionSummary
  readonly activation: ExtensionActivation
}

export type ExtensionAdoptionResult = {
  readonly extensionId: string
  readonly version: string
  readonly sha256: string
} & ({ readonly outcome: 'adopted' } | { readonly outcome: 'error'; readonly error: ErrorSummary })

export interface ExtensionApplyUpdatesResult {
  readonly adopted: readonly ExtensionAdoptionResult[]
  readonly activations: readonly ExtensionActivationResult[]
}

export type ExtensionUpdateIssue =
  | { readonly repositoryId: string; readonly error: ErrorSummary }
  | { readonly extensionId: string; readonly error: ErrorSummary }

export interface ExtensionCheckUpdatesResult {
  readonly updates: readonly ExtensionUpdateCandidate[]
  readonly issues: readonly ExtensionUpdateIssue[]
}

/** User-confirmed trust. A response declaring this identity is not authorization to replace the saved trust. */
export interface ExtensionRepositoryInput {
  readonly url: string
  readonly declaredId: string
  readonly trustedPublicKey: string
}

export interface ExtensionRepository extends ExtensionRepositoryInput {
  readonly id: string
}

export interface ExtensionRepositoryUpdate {
  readonly changes: Partial<ExtensionRepositoryInput>
  readonly expected?: Partial<ExtensionRepositoryInput>
}

/** This is a display projection of verified content; cryptographic verification still uses the original signed bytes. */
export interface ExtensionRegistrySnapshot {
  readonly registry: RegistryDocument
  readonly fetchedAt: number
  readonly responseUrl: string
}

export interface ExtensionRepositoryState {
  readonly repository: ExtensionRepository
  readonly cached: ExtensionRegistrySnapshot | null
  readonly error: ErrorSummary | null
}

/** Inspect has not created trust. The native UI must explicitly confirm the returned declared ID and public key. */
export interface ExtensionRepositoryInspection {
  readonly url: string
  readonly responseUrl: string
  readonly registry: RegistryDocument
}

export interface ExtensionRepositoriesApi {
  list(call?: CallOptions): Promise<readonly ExtensionRepositoryState[]>
  get(repositoryId: string, call?: CallOptions): Promise<ExtensionRepositoryState | null>
  inspect(url: string, call?: CallOptions): Promise<ExtensionRepositoryInspection>

  add(input: ExtensionRepositoryInput, call?: CallOptions): Promise<string>
  update(repositoryId: string, input: ExtensionRepositoryUpdate, call?: CallOptions): Promise<void>

  /** Unbind and revoke this repository's prepared updates; installed packages, enabled choices and private data remain. */
  remove(repositoryId: string, call?: CallOptions): Promise<void>

  refresh(repositoryId: string, call?: CallOptions): Promise<ExtensionRegistrySnapshot>

  onInvalidated(listener: () => void): Disposable
}

export interface ExtensionRuntimeApi {
  getState(call?: CallOptions): Promise<ExtensionRuntimeState>
  observe(listener: Listener<ExtensionRuntimeState>): Disposable

  /** Rebuild the shared host using committed versions only; no pending update or old business call is replayed. */
  restart(
    call?: CallOptions,
  ): Promise<{ readonly activations: readonly ExtensionActivationResult[] }>
}

/** Native management only. SDK adapters expose self information and navigation, not this installation/trust authority. */
export interface ExtensionsApi {
  readonly repositories: ExtensionRepositoriesApi
  readonly runtime: ExtensionRuntimeApi

  list(call?: CallOptions): Promise<readonly InstalledExtensionSummary[]>
  get(extensionId: string, call?: CallOptions): Promise<InstalledExtension | null>
  getState(extensionId: string, call?: CallOptions): Promise<ExtensionState | null>
  observe(extensionId: string, listener: Listener<ExtensionState | null>): Disposable

  /** Default enabled=true and attempt activation. An already installed ID requires the explicit update flow. */
  install(
    source: ExtensionPackageSource,
    options?: { readonly enabled?: boolean },
    call?: CallOptions,
  ): Promise<ExtensionInstallResult>

  enable(extensionId: string, call?: CallOptions): Promise<ExtensionState>
  disable(extensionId: string, call?: CallOptions): Promise<ExtensionState>

  uninstall(
    input: { readonly extensionId: string; readonly privateData: 'keep' | 'delete' },
    call?: CallOptions,
  ): Promise<void>

  checkUpdates(call?: CallOptions): Promise<ExtensionCheckUpdatesResult>
  prepareUpdate(
    extensionId: string,
    source: ExtensionPackageSource,
    call?: CallOptions,
  ): Promise<PreparedExtensionUpdate>

  /** Adopt exactly these receipts in one shared-host rebuild, returning actual per-package and activation outcomes. */
  applyUpdates(
    updates: readonly PreparedExtensionUpdate[],
    call?: CallOptions,
  ): Promise<ExtensionApplyUpdatesResult>

  setUpdateSource(
    extensionId: string,
    repositoryId: string | null,
    call?: CallOptions,
  ): Promise<void>
  setAllowPrerelease(
    extensionId: string,
    allowPrerelease: boolean,
    call?: CallOptions,
  ): Promise<void>

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

/** Select immutable repository coordinates or one explicit local file; no implicit latest lookup or source guessing. */
export function parseExtensionPackageSource(input: unknown): ExtensionPackageSource {
  return parseValue(source, input, 'Invalid extension package source')
}

/** Verify internal receipt identity; actual bytes and current repository trust must still be checked at adoption. */
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

/** Candidate selection is not preparation; its repository source must still identify the exact selected artifact. */
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

/** Existing missing/invalid installations remain readable instead of being dropped from the list. */
export function parseInstalledExtensionSummary(input: unknown): InstalledExtensionSummary {
  const value = parseValue(v.strictObject(summary), input, 'Invalid installed extension summary')
  if (value.preparedUpdate && value.preparedUpdate.extensionId !== value.id) {
    throw new DesktopError('InvalidInput', 'Prepared update belongs to another extension')
  }

  return value
}

/** Manifest absence is honest package state, not an empty fabricated manifest. */
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

/** Runtime states do not infer installation, compatibility or user intent. */
export function parseExtensionState(input: unknown): ExtensionState {
  return parseValue(v.strictObject({ extensionId, activation }), input, 'Invalid extension state')
}

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

/** A shared-host rebuild can include extensions not present in the requested update batch. */
export function parseExtensionActivationResult(input: unknown): ExtensionActivationResult {
  return parseValue(activationResult, input, 'Invalid extension activation result')
}

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

/** Preserve actual attempted items on interruption; absence does not mean adoption failed or rolled back. */
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

/** One failed repository does not erase candidates from other successfully checked sources. */
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

/** Native trust writes contain only the explicit URL, declared identity and trusted key, never response display fields. */
export function parseExtensionRepositoryInput(input: unknown): ExtensionRepositoryInput {
  return parseValue(
    v.strictObject(repositoryEntries),
    input,
    'Invalid extension repository trust input',
  )
}

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

/** Parse only the display projection; this does not authenticate an index or establish repository trust. */
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
