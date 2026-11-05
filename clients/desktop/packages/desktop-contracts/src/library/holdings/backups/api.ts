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

/** Snapshot sources retain the actual session's path/name even after the current configuration changes. */
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

/** Cleanup problems can accompany already committed success; they never turn an uncreated archive into a backup. */
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

/** Restore always fixes a current target and performs the native confirmation before any replacement. */
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

/** Target state describes actual known disk facts, independently of task success or a committed recovery resolution. */
export interface GameBackupRestoreResult {
  readonly backupId: string
  readonly target: { readonly path: string; readonly kind: 'file' | 'directory' }
  readonly targetState: 'restored' | 'preserved' | 'recoveryRequired' | 'keptCurrent'
  readonly protectionBackupId: string | null
  readonly recoveryId: string | null
  readonly recoveryResolution: RecoveryResolution | null
  readonly issues: readonly GameBackupIssue[]
}

/** Immutable operation receipt, published and durably indexed before the user target is modified. */
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

/** Progress is a monotonic hint only; it never authorizes repeating a filesystem mutation after interruption. */
export interface GameBackupRecoveryProgress {
  readonly recoveryId: string
  readonly sequence: number
  readonly phase: 'ready' | 'originalPreserved' | 'replacementPlaced' | 'rollbackStarted'
}

/** The index identifies owned materials. Pending records block conflicting work; resolved records permit explicit cleanup. */
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

export type RecoveryLocationObservation =
  | { readonly status: 'absent' }
  | {
      readonly status: 'readable'
      readonly kind: 'file' | 'directory'
      readonly treeDigest: string
    }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }

/** basis detects changed evidence, not authorization; resolve re-inspects rather than trusting the advertised actions. */
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

/** Independent recovery operations survive task-history cleanup and never auto-resume on application startup. */
export interface GameBackupRecoveriesApi {
  /**
   * Read persistent recovery records independently of task history, with the requested game and
   * resolution filters.
   */
  list(
    query: ListOptions & { readonly gameId?: string; readonly state?: 'pending' | 'resolved' },
    call?: CallOptions,
  ): Promise<ListResult<GameBackupRecovery>>

  /**
   * Read one recovery record and its stored manifest state without resuming or modifying
   * recovery.
   */
  get(
    id: string,
    call?: CallOptions,
  ): Promise<
    | (GameBackupRecovery & { readonly manifest: StoredDefinition<GameBackupRecoveryManifest> })
    | null
  >

  /**
   * Inspect actual target and retained materials, returning currently available actions and a
   * comparison basis without changing files.
   */
  inspect(id: string, call?: CallOptions): Promise<GameBackupRecoveryInspection>

  /**
   * Reinspect and compare the supplied basis before executing the explicit action; stale
   * evidence cannot authorize replacement.
   */
  resolve(
    input: {
      readonly recoveryId: string
      readonly action: RecoveryAction
      readonly expected: { readonly basis: string }
    },
    call?: CallOptions,
  ): Promise<GameBackupRestoreResult>

  /** Explicit cleanup only after resolution; a missing index is an idempotent success and protection backups remain. */
  remove(id: string, call?: CallOptions): Promise<void>
}

/** Backup operations use actual source/target paths and occupancy, never task history as proof of filesystem completion. */
export interface GameBackupsApi {
  /**
   * Read this game's archived snapshots by their actual creation time, retaining source identity
   * and lock state.
   */
  list(
    gameId: string,
    options: ListOptions & { readonly sourceConfigId?: string; readonly locked?: boolean },
    call?: CallOptions,
  ): Promise<ListResult<GameBackup>>

  /**
   * Read a saved backup record without opening its archive or claiming that the original source
   * still exists.
   */
  get(gameId: string, backupId: string, call?: CallOptions): Promise<GameBackup | null>

  /**
   * Prepare and verify a complete archive before committing the backup; an explicitly requested
   * unchanged result reuses the actual prior backup.
   */
  create(
    gameId: string,
    input: GameBackupCreateInput,
    call?: CallOptions,
  ): Promise<GameBackupCreateResult>

  /**
   * Confirm the fixed target, protect existing content and restore verified bytes; failure or
   * cancellation preserves actual target and recovery facts in any valid partial result.
   */
  restore(input: GameBackupRestoreInput, call?: CallOptions): Promise<GameBackupRestoreResult>

  /**
   * Protect this backup from automatic retention cleanup; explicit manual deletion remains a
   * separate operation.
   */
  lock(gameId: string, backupId: string, call?: CallOptions): Promise<void>

  /**
   * Remove automatic-retention protection without immediately deleting the backup or triggering
   * cleanup.
   */
  unlock(gameId: string, backupId: string, call?: CallOptions): Promise<void>

  /**
   * Compare and update only this backup's note; archive bytes, creation facts and source
   * identity remain immutable.
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
   * Explicitly delete the selected archives and records after occupancy checks; manual deletion
   * can include locked backups and never touches the current save target.
   */
  delete(gameId: string, backupIds: NonEmptyArray<string>, call?: CallOptions): Promise<void>

  readonly recoveries: GameBackupRecoveriesApi
}

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

const kind = v.picklist(['file', 'directory'])

const resolution = v.picklist(['restored', 'rolledBack', 'keptCurrent'])

const backupSource = v.variant('type', [
  v.strictObject({ type: v.literal('config'), launchConfigId: id }),
  v.strictObject({ type: v.literal('snapshot'), launchConfigId: id, launchConfigName: text, path }),
])

/** Validate a current configuration choice or fixed launch-time snapshot without resolving live files. */
export function parseGameBackupSource(input: unknown): GameBackupSource {
  return parseValue(backupSource, input, 'Invalid game backup source')
}

/** Validate explicit creation policy; source kind never guesses skipIfUnchanged. */
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

/** Fix a current configuration or explicit path, never the archive's historical absolute source path. */
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

/** Parse the immutable receipt's pure values; the recovery owner verifies the index, bytes and target relationship. */
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

/** Validate a progress hint. Monotonicity against earlier progress and actual disk truth are host responsibilities. */
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

/** Hash stable evidence only: error wording and observation timestamps cannot create spurious conflicts. */
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

/** Parse a legal full or partial restore result, retaining target facts independently of committed recovery state. */
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
