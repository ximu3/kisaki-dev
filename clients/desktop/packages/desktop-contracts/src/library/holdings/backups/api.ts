/** @fileoverview Defines backup and recovery operations together with their input and result value validation. */

import type { ErrorSummary } from '../../../errors'
import type {
  ListOptions,
  CallOptions,
  ListResult,
  StoredDefinition,
  NonEmptyArray,
} from '../../../operations'

import * as v from 'valibot'
import { parseAbsolutePath } from '../../../paths'
import { id, text, parseValue, timestamp, nonnegativeInteger } from '../../../validation'

import { digest } from './archive'

import { bytesToHex } from '@noble/hashes/utils.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { parseErrorSummary, DesktopError } from '../../../errors'

/**
 * A current configuration or fixed launch-time source snapshot for backup creation.
 *
 * Snapshots retain the session's path and name after configuration changes.
 */
export type GameBackupSource =
  | { readonly type: 'config'; readonly launchConfigId: string }
  | {
      readonly type: 'snapshot'
      readonly launchConfigId: string
      readonly launchConfigName: string
      readonly path: string
    }

/** The cause of this archived snapshot; protection backups created before replacement use beforeRestore. */
export type GameBackupReason = 'manual' | 'automatic' | 'beforeRestore'

/** A saved game archive's source facts, content identity and retention settings. */
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
 * A retention, cleanup or recovery-evidence failure accompanying a backup operation.
 *
 * Ancillary failures can accompany committed success; they cannot establish an archive that was
 * never created.
 */
export type GameBackupIssue =
  | { readonly code: 'retentionFailed'; readonly backupId: string; readonly error: ErrorSummary }
  | { readonly code: 'cleanupFailed'; readonly path: string; readonly error: ErrorSummary }
  | {
      readonly code: 'recoveryUnavailable'
      readonly location: RecoveryLocation | 'manifest' | 'index'
      readonly error: ErrorSummary
    }

/** A newly created backup or an unchanged result referencing the actual prior backup. */
export interface GameBackupCreateResult {
  readonly outcome: 'created' | 'unchanged'
  readonly backupId: string
  readonly issues: readonly GameBackupIssue[]
}

/** An explicit backup source, unchanged-content policy and optional note. */
export interface GameBackupCreateInput {
  readonly source: GameBackupSource
  readonly skipIfUnchanged: boolean
  readonly note?: string | null
}

/**
 * A backup and explicitly selected current restore target.
 *
 * Restoration fixes the target and performs native confirmation before replacement.
 */
export interface GameBackupRestoreInput {
  readonly gameId: string
  readonly backupId: string
  readonly target:
    | { readonly type: 'config'; readonly launchConfigId: string }
    | { readonly type: 'path'; readonly path: string }
}

/** A target or retained-material location examined by the recovery workflow. */
export type RecoveryLocation = 'target' | 'original' | 'prepared' | 'displaced'

/**
 * An explicit choice to continue replacement, restore the original or keep current target content.
 */
export type RecoveryAction = 'continue' | 'rollback' | 'keepCurrent'

/** The durably recorded outcome of an explicitly resolved recovery. */
export type RecoveryResolution = 'restored' | 'rolledBack' | 'keptCurrent'

/**
 * Known target-disk facts, protection references and recovery outcome from restoration.
 *
 * Target state is independent of task success and committed recovery resolution.
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

/** An immutable recovery receipt published and durably indexed before target modification. */
export interface GameBackupRecoveryManifest {
  readonly formatVersion: 1
  readonly recoveryId: string
  readonly gameId: string
  readonly backupId: string
  readonly protectionBackupId: string | null
  readonly target: { readonly path: string; readonly kind: 'file' | 'directory' }

  readonly before:
    { readonly type: 'absent' } | { readonly type: 'present'; readonly treeDigest: string }
  readonly after: { readonly treeDigest: string }
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
}

/**
 * A monotonic progress hint for one recovery.
 *
 * After interruption, the hint alone cannot authorize repeating a filesystem mutation.
 */
export interface GameBackupRecoveryProgress {
  readonly recoveryId: string
  readonly sequence: number
  readonly phase: 'ready' | 'originalPreserved' | 'replacementPlaced' | 'rollbackStarted'
}

/**
 * The durable index record identifying recovery-owned materials and resolution.
 *
 * Pending records block conflicting work. Resolved records permit explicit cleanup.
 */
export type GameBackupRecovery = {
  readonly id: string
  readonly gameId: string
  readonly backupId: string
  readonly protectionBackupId: string | null

  readonly targetPath: string
  readonly targetKind: 'file' | 'directory'

  readonly workspacePath: string
  readonly manifestSha256: string

  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
} & (
  | { readonly resolution: null; readonly resolvedAt: null }
  | {
      readonly resolution: RecoveryResolution
      /** UTC milliseconds since the Unix epoch. */
      readonly resolvedAt: number
    }
)

/** Observed absence, readable content identity or read failure at one recovery location. */
export type RecoveryLocationObservation =
  | { readonly status: 'absent' }
  | {
      readonly status: 'readable'
      readonly kind: 'file' | 'directory'
      readonly treeDigest: string
    }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }

/**
 * Current recovery evidence, available actions and a comparison basis.
 *
 * The basis detects evidence changes; resolve reinspects actual state before authorizing an action.
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

/**
 * Persistent recovery inspection, explicit resolution and post-resolution cleanup.
 *
 * Records survive task-history cleanup, and application startup does not automatically resume them.
 */
export interface GameBackupRecoveriesApi {
  /** Lists durable recovery records under the requested game and resolution filters. */
  list(
    query: ListOptions & { readonly gameId?: string; readonly state?: 'pending' | 'resolved' },
    call?: CallOptions,
  ): Promise<ListResult<GameBackupRecovery>>

  /**
   * Reads a recovery record and stored manifest state, or null when the record is absent.
   *
   * The read does not resume or modify recovery.
   */
  get(
    id: string,
    call?: CallOptions,
  ): Promise<
    | (GameBackupRecovery & { readonly manifest: StoredDefinition<GameBackupRecoveryManifest> })
    | null
  >

  /**
   * Inspects actual target and retained materials without changing files.
   *
   * Returns currently available actions and their evidence-comparison basis.
   */
  inspect(id: string, call?: CallOptions): Promise<GameBackupRecoveryInspection>

  /**
   * Reinspects and compares the supplied basis before executing the explicit recovery action.
   *
   * Stale evidence cannot authorize replacement.
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
   * Removes recovery-owned materials explicitly after resolution.
   *
   * A missing index is an idempotent success. Protection backups remain.
   */
  remove(id: string, call?: CallOptions): Promise<void>
}

/**
 * Game save archives, protected restoration and independent recovery management.
 *
 * Operations check actual paths and occupancy; task history does not establish filesystem
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
   * Reads a saved backup record, or null when it is absent.
   *
   * The read does not open the archive or establish that the original source remains available.
   */
  get(gameId: string, backupId: string, call?: CallOptions): Promise<GameBackup | null>

  /**
   * Prepares and verifies a complete archive before committing its backup record.
   *
   * When requested, an unchanged result reuses the actual prior backup.
   */
  create(
    gameId: string,
    input: GameBackupCreateInput,
    call?: CallOptions,
  ): Promise<GameBackupCreateResult>

  /**
   * Confirms the fixed target, protects existing content and restores verified bytes.
   *
   * Failure or cancellation retains known target and recovery facts in any valid partial result.
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
   * Compares and updates the backup's note.
   *
   * Archive bytes, creation facts and source identity remain immutable.
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
   * Deletes selected archives and records explicitly after occupancy checks.
   *
   * Manual deletion may include locked backups and leaves the current save target unchanged.
   */
  delete(gameId: string, backupIds: NonEmptyArray<string>, call?: CallOptions): Promise<void>

  readonly recoveries: GameBackupRecoveriesApi
}

/** Validated absolute source or recovery destination path. */
const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

/** Content-tree root kind retained by backup and recovery values. */
const kind = v.picklist(['file', 'directory'])

/** Explicit terminal decisions that resolve a pending backup recovery. */
const resolution = v.picklist(['restored', 'rolledBack', 'keptCurrent'])

/** Current launch configuration or saved occurrence snapshot chosen as the backup source. */
const backupSource = v.variant('type', [
  v.strictObject({ type: v.literal('config'), launchConfigId: id }),
  v.strictObject({ type: v.literal('snapshot'), launchConfigId: id, launchConfigName: text, path }),
])

/** Parses a current configuration choice or fixed source snapshot without resolving live files. */
export function parseGameBackupSource(input: unknown): GameBackupSource {
  return parseValue(backupSource, input, 'Invalid game backup source')
}

/** Parses backup creation intent with an explicitly supplied unchanged-content policy. */
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

/** Parses an explicit current configuration or path as the restore target. */
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

/**
 * Parses immutable recovery-receipt values.
 *
 * The recovery owner verifies the index, actual bytes and target relationship.
 */
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

/**
 * Parses a recovery progress hint.
 *
 * The host checks sequence monotonicity and actual disk state separately.
 */
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
 * Hashes indexed identity, the actual manifest digest and location observations.
 *
 * Error wording and observation timestamps are excluded from the comparison basis.
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
 * Parses a full or partial restore result and checks recovery-reference consistency.
 *
 * Target facts remain independent of the committed recovery state.
 */
export function parseGameBackupRestoreResult(input: unknown): GameBackupRestoreResult {
  const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))
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
