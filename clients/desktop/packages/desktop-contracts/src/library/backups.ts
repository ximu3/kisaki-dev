/** @fileoverview Defines game save archives, explicit recovery decisions and independent backup management. */

import type { ErrorSummary } from '../errors'
import type {
  CallOptions,
  ListOptions,
  ListResult,
  NonEmptyArray,
  StoredDefinition,
} from '../operations'

/** Snapshot sources retain the actual session's path/name even after the current configuration changes. */
export type GameBackupSource =
  | { readonly type: 'config'; readonly launchConfigId: string }
  | {
      readonly type: 'snapshot'
      readonly launchConfigId: string
      readonly launchConfigName: string
      readonly path: string
    }

/** Source content means all regular files and directories; missing content is not an empty save. */
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

/** Relative paths preserve source names; root has path ''. Target-platform representability is checked before extraction. */
export type GameBackupArchiveEntry =
  | { readonly path: string; readonly type: 'directory' }
  | {
      readonly path: string
      readonly type: 'file'
      readonly sizeBytes: number
      readonly sha256: string
    }

export interface GameBackupArchiveManifest {
  readonly format: 'kisaki-game-save'
  readonly formatVersion: 1
  readonly entries: NonEmptyArray<GameBackupArchiveEntry>
  readonly treeDigest: string
}

/** Rows have a fixed compact JSON encoding independent of ZIP ordering, compression and timestamps. */
export type GameBackupTreeRow =
  | readonly [path: string, type: 'directory']
  | readonly [path: string, type: 'file', sizeBytes: number, sha256: string]

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
  readonly createdAt: number
} & (
  | { readonly resolution: null; readonly resolvedAt: null }
  | { readonly resolution: RecoveryResolution; readonly resolvedAt: number }
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
  list(
    query: ListOptions & { readonly gameId?: string; readonly state?: 'pending' | 'resolved' },
    call?: CallOptions,
  ): Promise<ListResult<GameBackupRecovery>>
  get(
    id: string,
    call?: CallOptions,
  ): Promise<
    | (GameBackupRecovery & { readonly manifest: StoredDefinition<GameBackupRecoveryManifest> })
    | null
  >
  inspect(id: string, call?: CallOptions): Promise<GameBackupRecoveryInspection>

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
