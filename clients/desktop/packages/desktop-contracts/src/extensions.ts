import type { CallOptions, Disposable, Listener } from './operations'
import * as v from 'valibot'
import {
  fromParser,
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
import {
  parseVersion,
  parseTarget,
  normalizeTargets,
  type ExtensionTarget,
  type CompatibilityIssue,
} from '@kisaki3/extension-distribution/compatibility'
import { parseErrorSummary, DesktopError, type ErrorSummary } from './errors'
import {
  parsePublicKey,
  normalizeRegistry,
  type RegistryDocument,
} from '@kisaki3/extension-distribution/registry'
import { parseAbsolutePath } from './paths'
import { parseHttpUrl } from './network'
import { normalizeManifest, type ExtensionManifest } from '@kisaki3/extension-distribution/manifest'

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

  remove(repositoryId: string, call?: CallOptions): Promise<void>

  refresh(repositoryId: string, call?: CallOptions): Promise<ExtensionRegistrySnapshot>

  onInvalidated(listener: () => void): Disposable
}

export interface ExtensionRuntimeApi {
  getState(call?: CallOptions): Promise<ExtensionRuntimeState>

  observe(listener: Listener<ExtensionRuntimeState>): Disposable

  restart(
    call?: CallOptions,
  ): Promise<{ readonly activations: readonly ExtensionActivationResult[] }>
}

export interface ExtensionsApi {
  readonly repositories: ExtensionRepositoriesApi
  readonly runtime: ExtensionRuntimeApi

  list(call?: CallOptions): Promise<readonly InstalledExtensionSummary[]>

  get(extensionId: string, call?: CallOptions): Promise<InstalledExtension | null>

  getState(extensionId: string, call?: CallOptions): Promise<ExtensionState | null>

  observe(extensionId: string, listener: Listener<ExtensionState | null>): Disposable

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

const extensionId = fromParser((value) =>
  parseExternalValue(parseId, value, 'Invalid extension identity'),
)

const version = fromParser((value) =>
  parseExternalValue(parseVersion, value, 'Invalid extension version'),
)

const sha256 = v.pipe(text, v.regex(/^[a-f0-9]{64}$/))

const targets = fromParser((value) =>
  parseExternalValue(normalizeTargets, value, 'Invalid extension targets'),
)

const error = fromParser(parseErrorSummary)

const publicKey = fromParser((value) =>
  parseExternalValue(parsePublicKey, value, 'Invalid repository public key'),
)

const path = fromParser(parseAbsolutePath)

const url = fromParser(parseHttpUrl)

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

const compatibilityIssue = v.variant('condition', [
  v.strictObject({
    condition: v.literal('target'),
    required: fromParser((value) =>
      parseExternalValue(normalizeTargets, value, 'Invalid required targets'),
    ),
    actual: fromParser((value) => parseExternalValue(parseTarget, value, 'Invalid actual target')),
  }),
  v.strictObject({
    condition: v.literal('apiVersion'),
    required: text,
    actual: text,
  }),
  v.strictObject({
    condition: v.picklist(['nodeVersion', 'electronVersion']),
    required: text,
    actual: v.exactOptional(text),
  }),
])

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

  preparedUpdate: v.nullable(fromParser(parsePreparedExtensionUpdate)),

  packageState,
  compatibility,
}

export function parseExtensionPackageSource(input: unknown): ExtensionPackageSource {
  return parseValue(source, input, 'Invalid extension package source')
}

export function parseExtensionArtifactIdentity(input: unknown): ExtensionArtifactIdentity {
  return parseValue(v.strictObject(artifact), input, 'Invalid extension artifact identity')
}

function matchesRepositoryArtifact(
  artifact: ExtensionArtifactIdentity,
  source: Extract<ExtensionPackageSource, { type: 'repository' }>,
): boolean {
  return (
    source.extensionId === artifact.extensionId &&
    source.version === artifact.version &&
    source.sha256 === artifact.sha256
  )
}

export function parsePreparedExtensionUpdate(input: unknown): PreparedExtensionUpdate {
  const value = parseValue(
    v.strictObject({ ...artifact, source: preparedSource }),
    input,
    'Invalid prepared extension update',
  )
  if (value.source.type === 'repository' && !matchesRepositoryArtifact(value, value.source)) {
    throw new DesktopError('InvalidInput', 'Prepared extension source does not match its artifact')
  }

  return value
}

export function parseExtensionUpdateCandidate(input: unknown): ExtensionUpdateCandidate {
  const value = parseValue(
    v.strictObject({ ...artifact, source: v.strictObject(repositorySource) }),
    input,
    'Invalid extension update candidate',
  )
  if (!matchesRepositoryArtifact(value, value.source)) {
    throw new DesktopError('InvalidInput', 'Extension candidate source does not match its artifact')
  }

  return value
}

function checkPreparedUpdateOwner(installed: InstalledExtensionSummary): void {
  if (installed.preparedUpdate && installed.preparedUpdate.extensionId !== installed.id) {
    throw new DesktopError('InvalidInput', 'Prepared update belongs to another extension')
  }
}

export function parseInstalledExtensionSummary(input: unknown): InstalledExtensionSummary {
  const value = parseValue(v.strictObject(summary), input, 'Invalid installed extension summary')
  checkPreparedUpdateOwner(value)

  return value
}

export function parseInstalledExtension(input: unknown): InstalledExtension {
  const value = parseValue(
    v.strictObject({
      ...summary,
      manifest: v.nullable(
        fromParser((value) =>
          parseExternalValue(normalizeManifest, value, 'Invalid installed manifest'),
        ),
      ),
    }),
    input,
    'Invalid installed extension',
  )
  checkPreparedUpdateOwner(value)
  const { manifest } = value
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

export function parseExtensionActivationResult(input: unknown): ExtensionActivationResult {
  return parseValue(activationResult, input, 'Invalid extension activation result')
}

export function parseExtensionInstallResult(input: unknown): ExtensionInstallResult {
  return parseValue(
    v.strictObject({
      extension: fromParser(parseInstalledExtensionSummary),
      activation,
    }),
    input,
    'Invalid extension installation result',
  )
}

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

export function parseExtensionCheckUpdatesResult(input: unknown): ExtensionCheckUpdatesResult {
  return parseValue(
    v.strictObject({
      updates: v.pipe(
        v.array(fromParser(parseExtensionUpdateCandidate)),
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

export function parseExtensionRegistrySnapshot(input: unknown): ExtensionRegistrySnapshot {
  return parseValue(
    v.strictObject({
      registry: fromParser((value) =>
        parseExternalValue(normalizeRegistry, value, 'Invalid registry projection'),
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
