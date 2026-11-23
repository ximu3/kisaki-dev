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

/** A launch snapshot retains the session's path and source name after configuration changes. */
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
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number

  readonly note: string | null
  readonly locked: boolean
}

/**
 * Ancillary failures can accompany a committed backup. Use the main outcome to determine whether an
 * archive exists.
 */
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

/** Restoration fixes the selected target and requires native confirmation before replacement. */
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

/**
 * The target's actual state on disk can differ from task status and the recorded recovery
 * resolution.
 */
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
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
}

/** After interruption, check the actual disk state before repeating a filesystem mutation. */
export interface GameBackupRecoveryProgress {
  readonly recoveryId: string
  readonly sequence: number
  readonly phase: 'ready' | 'originalPreserved' | 'replacementPlaced' | 'rollbackStarted'
}

/** Pending records block conflicting work. Resolved records permit explicit cleanup. */
export type GameBackupRecovery = {
  readonly id: string
  readonly gameId: string
  readonly backupId: string
  readonly protectionBackupId: string | null

  readonly targetPath: string
  readonly targetKind: 'file' | 'directory'

  readonly workspacePath: string
  /** Null until the durable manifest is registered. */
  readonly manifestSha256: string | null

  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
} & (
  | { readonly resolution: null; readonly resolvedAt: null }
  | {
      readonly resolution: 'keptCurrent'
      /** UTC milliseconds since the Unix epoch. */
      readonly resolvedAt: number
    }
  | {
      readonly resolution: 'restored' | 'rolledBack'
      readonly manifestSha256: string
      /** UTC milliseconds since the Unix epoch. */
      readonly resolvedAt: number
    }
)

/** A published manifest can be unreadable or invalid. An unpublished one has no stored value. */
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

/**
 * Use the basis to compare the displayed evidence at resolve time. Resolve reinspects the actual
 * locations before executing an action.
 */
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

/** Records survive clearing task history. Recovery resumes only through explicit operations. */
export interface GameBackupRecoveriesApi {
  list(
    query: ListOptions & { readonly gameId?: string; readonly state?: 'pending' | 'resolved' },
    call?: CallOptions,
  ): Promise<ListResult<GameBackupRecovery>>

  /** Returns null for an absent record. A read leaves recovery progress unchanged. */
  get(id: string, call?: CallOptions): Promise<GameBackupRecoveryDetail | null>

  /**
   * Returns the actions available for the observed locations and a basis to compare before
   * executing any of them.
   */
  inspect(id: string, call?: CallOptions): Promise<GameBackupRecoveryInspection>

  /**
   * Reinspects actual state and rejects a stale evidence basis before executing the requested
   * action.
   */
  resolve(
    input: {
      readonly recoveryId: string
      readonly action: RecoveryAction
      readonly expected: { readonly basis: string }
    },
    call?: CallOptions,
  ): Promise<GameBackupRestoreResult>

  /**
   * Cleanup requires a resolved recovery. A missing record is idempotent success. Protection
   * backups remain.
   */
  remove(id: string, call?: CallOptions): Promise<void>
}

/**
 * Operations check actual paths and occupancy. Use their results to determine filesystem
 * completion.
 */
export interface GameBackupsApi {
  /**
   * Lists the game's archived snapshots by creation time, retaining source identity and lock state.
   */
  list(
    gameId: string,
    options: ListOptions & { readonly sourceConfigId?: string; readonly locked?: boolean },
    call?: CallOptions,
  ): Promise<ListResult<GameBackup>>

  /**
   * Returns null for an absent record. The record remains readable independently of archive and
   * source availability.
   */
  get(gameId: string, backupId: string, call?: CallOptions): Promise<GameBackup | null>

  /**
   * Verifies the complete archive before committing. The reuse policy can return the actual
   * previous backup when content is unchanged.
   */
  create(
    gameId: string,
    input: GameBackupCreateInput,
    call?: CallOptions,
  ): Promise<GameBackupCreateResult>

  /**
   * Includes known target state and recovery details in any partial result after failure or
   * cancellation. The fixed target is confirmed and existing content protected before replacement.
   */
  restore(input: GameBackupRestoreInput, call?: CallOptions): Promise<GameBackupRestoreResult>

  /**
   * Protects the backup from automatic retention cleanup while leaving explicit deletion available.
   */
  lock(gameId: string, backupId: string, call?: CallOptions): Promise<void>

  /**
   * Removes automatic-retention protection without immediately deleting or cleaning up the backup.
   */
  unlock(gameId: string, backupId: string, call?: CallOptions): Promise<void>

  /**
   * Only the note can change. Archive bytes, creation facts and source identity remain immutable.
   */
  update(
    gameId: string,
    backupId: string,
    input: {
      readonly changes: { readonly note: string | null }
      readonly expected?: { readonly note: string | null }
    },
    call?: CallOptions,
  ): Promise<void>

  /**
   * Manual deletion may include locked backups. It checks occupancy and preserves the current save
   * target.
   */
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

/** Parses a current configuration choice or fixed source snapshot without resolving live files. */
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

/** The recovery owner verifies the index, actual bytes and target relationship. */
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

/** The recovery owner checks progress sequence and actual disk state. */
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

/**
 * The comparison basis hashes indexed identity, manifest digest and location observations.
 * Diagnostic wording and observation timestamps are excluded.
 */
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

/**
 * Checks recovery-reference consistency. The target's actual state remains independent of the
 * committed recovery state.
 */
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
