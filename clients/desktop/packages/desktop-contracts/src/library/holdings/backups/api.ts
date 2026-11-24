import type {
  ListOptions,
  CallOptions,
  ListResult,
  StoredDefinition,
  NonEmptyArray,
} from '../../../operations'

import * as v from 'valibot'
import { parseAbsolutePath } from '../../../paths'
import {
  fromParser,
  id,
  text,
  parseValue,
  timestamp,
  nonnegativeInteger,
} from '../../../validation'

import { digest } from './archive'

import { bytesToHex } from '@noble/hashes/utils.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { parseErrorSummary, DesktopError, type ErrorSummary } from '../../../errors'

export type GameBackupSource =
  | { readonly type: 'config'; readonly launchConfigId: string }
  | {
      readonly type: 'snapshot'
      readonly launchConfigId: string
      readonly launchConfigName: string
      readonly path: string
    }

export type GameBackupReason = 'manual' | 'automatic' | 'beforeRestore'

export interface GameBackup {
  readonly id: string
  readonly gameId: string

  readonly sourceConfigId: string | null
  readonly sourceConfigName: string
  readonly sourcePath: string
  readonly sourceKind: 'file' | 'directory'
  readonly reason: GameBackupReason

  readonly archiveAttachmentId: string
  readonly treeDigest: string
  readonly unpackedSizeBytes: number
  readonly createdAt: number

  readonly note: string | null
  readonly locked: boolean
}

export type GameBackupIssue =
  | { readonly code: 'retentionFailed'; readonly backupId: string; readonly error: ErrorSummary }
  | { readonly code: 'cleanupFailed'; readonly path: string; readonly error: ErrorSummary }
  | {
      readonly code: 'recoveryUnavailable'
      readonly location: RecoveryLocation | 'manifest' | 'index'
      readonly error: ErrorSummary
    }

export interface GameBackupCreateResult {
  readonly outcome: 'created' | 'unchanged'
  readonly backupId: string
  readonly issues: readonly GameBackupIssue[]
}

export interface GameBackupCreateInput {
  readonly source: GameBackupSource
  readonly skipIfUnchanged: boolean
  readonly note?: string | null
}

export interface GameBackupRestoreInput {
  readonly gameId: string
  readonly backupId: string
  readonly target:
    | { readonly type: 'config'; readonly launchConfigId: string }
    | { readonly type: 'path'; readonly path: string }
}

export type RecoveryLocation = 'target' | 'original' | 'prepared' | 'displaced'

export type RecoveryAction = 'continue' | 'rollback' | 'keepCurrent'

export type RecoveryResolution = 'restored' | 'rolledBack' | 'keptCurrent'

export interface GameBackupRestoreResult {
  readonly backupId: string
  readonly target: { readonly path: string; readonly kind: 'file' | 'directory' }
  readonly targetState: 'restored' | 'preserved' | 'recoveryRequired' | 'keptCurrent'

  readonly protectionBackupId: string | null
  readonly recoveryId: string | null
  readonly recoveryResolution: RecoveryResolution | null

  readonly issues: readonly GameBackupIssue[]
}

export interface GameBackupRecoveryManifest {
  readonly formatVersion: 1
  readonly recoveryId: string
  readonly gameId: string
  readonly backupId: string
  readonly protectionBackupId: string | null
  readonly target: { readonly path: string; readonly kind: 'file' | 'directory' }

  readonly before:
    | { readonly type: 'absent' }
    | { readonly type: 'present'; readonly treeDigest: string }
  readonly after: { readonly treeDigest: string }
  readonly createdAt: number
}

export interface GameBackupRecoveryProgress {
  readonly recoveryId: string
  readonly sequence: number
  readonly phase: 'ready' | 'originalPreserved' | 'replacementPlaced' | 'rollbackStarted'
}

export type GameBackupRecovery = {
  readonly id: string
  readonly gameId: string
  readonly backupId: string
  readonly protectionBackupId: string | null

  readonly targetPath: string
  readonly targetKind: 'file' | 'directory'

  readonly workspacePath: string
  readonly manifestSha256: string | null

  readonly createdAt: number
} & (
  | { readonly resolution: null; readonly resolvedAt: null }
  | {
      readonly resolution: 'keptCurrent'
      readonly resolvedAt: number
    }
  | {
      readonly resolution: 'restored' | 'rolledBack'
      readonly manifestSha256: string
      readonly resolvedAt: number
    }
)

export type GameBackupRecoveryDetail = GameBackupRecovery &
  (
    | { readonly manifestSha256: null; readonly manifest: null }
    | {
        readonly manifestSha256: string
        readonly manifest: StoredDefinition<GameBackupRecoveryManifest>
      }
  )

export type RecoveryLocationObservation =
  | { readonly status: 'absent' }
  | {
      readonly status: 'readable'
      readonly kind: 'file' | 'directory'
      readonly treeDigest: string
    }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }

export interface GameBackupRecoveryInspection {
  readonly recoveryId: string
  readonly resolution: RecoveryResolution | null

  readonly manifest: GameBackupRecoveryManifest | null
  readonly locations: Readonly<Record<RecoveryLocation, RecoveryLocationObservation>>

  readonly actions: readonly RecoveryAction[]
  readonly issues: readonly {
    readonly location: RecoveryLocation | 'manifest' | 'index'
    readonly error: ErrorSummary
  }[]
  readonly basis: string
}

export interface GameBackupRecoveriesApi {
  list(
    query: ListOptions & { readonly gameId?: string; readonly state?: 'pending' | 'resolved' },
    call?: CallOptions,
  ): Promise<ListResult<GameBackupRecovery>>

  get(id: string, call?: CallOptions): Promise<GameBackupRecoveryDetail | null>

  inspect(id: string, call?: CallOptions): Promise<GameBackupRecoveryInspection>

  resolve(
    input: {
      readonly recoveryId: string
      readonly action: RecoveryAction
      readonly expected: { readonly basis: string }
    },
    call?: CallOptions,
  ): Promise<GameBackupRestoreResult>

  remove(id: string, call?: CallOptions): Promise<void>
}

export interface GameBackupsApi {
  list(
    gameId: string,
    options: ListOptions & { readonly sourceConfigId?: string; readonly locked?: boolean },
    call?: CallOptions,
  ): Promise<ListResult<GameBackup>>

  get(gameId: string, backupId: string, call?: CallOptions): Promise<GameBackup | null>

  create(
    gameId: string,
    input: GameBackupCreateInput,
    call?: CallOptions,
  ): Promise<GameBackupCreateResult>

  restore(input: GameBackupRestoreInput, call?: CallOptions): Promise<GameBackupRestoreResult>

  lock(gameId: string, backupId: string, call?: CallOptions): Promise<void>

  unlock(gameId: string, backupId: string, call?: CallOptions): Promise<void>

  update(
    gameId: string,
    backupId: string,
    input: {
      readonly changes: { readonly note: string | null }
      readonly expected?: { readonly note: string | null }
    },
    call?: CallOptions,
  ): Promise<void>

  delete(gameId: string, backupIds: NonEmptyArray<string>, call?: CallOptions): Promise<void>

  readonly recoveries: GameBackupRecoveriesApi
}

const path = fromParser(parseAbsolutePath)

const kind = v.picklist(['file', 'directory'])

const resolution = v.picklist(['restored', 'rolledBack', 'keptCurrent'])

const backupSource = v.variant('type', [
  v.strictObject({ type: v.literal('config'), launchConfigId: id }),
  v.strictObject({ type: v.literal('snapshot'), launchConfigId: id, launchConfigName: text, path }),
])

export function parseGameBackupSource(input: unknown): GameBackupSource {
  return parseValue(backupSource, input, 'Invalid game backup source')
}

export function parseGameBackupCreateInput(input: unknown): GameBackupCreateInput {
  return parseValue(
    v.strictObject({
      source: backupSource,
      skipIfUnchanged: v.boolean(),
      note: v.exactOptional(v.nullable(text)),
    }),
    input,
    'Invalid game backup creation',
  )
}

export function parseGameBackupRestoreInput(input: unknown): GameBackupRestoreInput {
  return parseValue(
    v.strictObject({
      gameId: id,
      backupId: id,
      target: v.variant('type', [
        v.strictObject({ type: v.literal('config'), launchConfigId: id }),
        v.strictObject({ type: v.literal('path'), path }),
      ]),
    }),
    input,
    'Invalid game backup restore',
  )
}

export function parseGameBackupRecoveryManifest(input: unknown): GameBackupRecoveryManifest {
  return parseValue(
    v.strictObject({
      formatVersion: v.literal(1),
      recoveryId: id,
      gameId: id,
      backupId: id,
      protectionBackupId: v.nullable(id),
      target: v.strictObject({ path, kind }),
      before: v.variant('type', [
        v.strictObject({ type: v.literal('absent') }),
        v.strictObject({ type: v.literal('present'), treeDigest: digest }),
      ]),
      after: v.strictObject({ treeDigest: digest }),
      createdAt: timestamp,
    }),
    input,
    'Invalid recovery manifest',
  )
}

export function parseGameBackupRecoveryProgress(input: unknown): GameBackupRecoveryProgress {
  return parseValue(
    v.strictObject({
      recoveryId: id,
      sequence: nonnegativeInteger,
      phase: v.picklist(['ready', 'originalPreserved', 'replacementPlaced', 'rollbackStarted']),
    }),
    input,
    'Invalid recovery progress',
  )
}

export function gameBackupRecoveryBasis(
  index: GameBackupRecovery,
  actualManifestSha256: string | null,
  locations: Readonly<Record<RecoveryLocation, RecoveryLocationObservation>>,
): string {
  const order: readonly RecoveryLocation[] = ['target', 'original', 'prepared', 'displaced']
  const observations = order.map((location) => {
    const value = locations[location]
    if (value.status === 'absent') {
      return [location, 'absent']
    }
    if (value.status === 'unavailable') {
      return [location, 'unavailable', value.error.code]
    }

    return [location, 'readable', value.kind, value.treeDigest]
  })

  const identity = [
    index.id,
    index.gameId,
    index.backupId,
    index.protectionBackupId,
    index.targetPath,
    index.targetKind,
    index.workspacePath,
    index.manifestSha256,
    index.resolution,
    index.resolvedAt,
  ]

  return bytesToHex(
    sha256(
      new TextEncoder().encode(JSON.stringify([identity, actualManifestSha256, observations])),
    ),
  )
}

export function parseGameBackupRestoreResult(input: unknown): GameBackupRestoreResult {
  const error = fromParser(parseErrorSummary)
  const issue = v.variant('code', [
    v.strictObject({ code: v.literal('retentionFailed'), backupId: id, error }),
    v.strictObject({ code: v.literal('cleanupFailed'), path, error }),
    v.strictObject({
      code: v.literal('recoveryUnavailable'),
      location: v.picklist(['target', 'original', 'prepared', 'displaced', 'manifest', 'index']),
      error,
    }),
  ])
  const value = parseValue(
    v.strictObject({
      backupId: id,
      target: v.strictObject({ path, kind }),
      targetState: v.picklist(['restored', 'preserved', 'recoveryRequired', 'keptCurrent']),
      protectionBackupId: v.nullable(id),
      recoveryId: v.nullable(id),
      recoveryResolution: v.nullable(resolution),
      issues: v.array(issue),
    }),
    input,
    'Invalid game backup restore result',
  )
  if (
    (value.recoveryId === null && value.recoveryResolution !== null) ||
    (value.targetState === 'keptCurrent' && value.recoveryResolution !== 'keptCurrent')
  ) {
    throw new DesktopError('InvalidInput', 'Inconsistent game backup recovery result')
  }

  return value
}
