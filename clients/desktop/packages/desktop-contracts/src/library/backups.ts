/** @fileoverview Defines game-save archives, deterministic content trees, and explicit backup/recovery operations. */

import * as v from 'valibot'
import { ExecutionError, type ErrorSummary } from '../errors'
import type { CallOptions, Disposable, ListOptions, ListResult } from '../execution'
import { parseJsonDocument } from '../json'
import { objectSchema } from '../schema'
import { nonnegativeIntegerSchema, nonemptyStringSchema, parseContract } from '../validation'

/** A fixed source retains its historical configuration identity even after that configuration is removed. */
export type GameBackupSource =
  | { readonly type: 'config'; readonly launchConfigId: string }
  | {
      readonly type: 'snapshot'
      readonly launchConfigId: string
      readonly launchConfigName: string
      readonly path: string
    }
export type GameBackupReason = 'manual' | 'automatic' | 'beforeRestore'
/** A completed operation may report cleanup issues without denying its already committed result. */
export interface GameBackupIssue {
  readonly error: ErrorSummary
}
export interface GameBackupCreateResult {
  readonly outcome: 'created' | 'unchanged'
  readonly backupId: string
  readonly issues: readonly GameBackupIssue[]
}
/** A saved archive is independent of the current configuration and never contains a caller-chosen restore target. */
export interface GameBackup {
  readonly id: string
  readonly gameId: string
  readonly sourceConfigId: string | null
  readonly sourcePath: string
  readonly sourceKind: 'file' | 'directory'
  readonly sourceConfigName: string
  readonly reason: GameBackupReason
  readonly createdAt: number
  readonly note: string | null
  readonly locked: boolean
  readonly archiveAttachmentId: string
  readonly archiveSizeBytes: number
  readonly archiveSha256: string
  readonly treeDigest: string
  readonly unpackedSizeBytes: number
}

/** The empty path is the root. Files retain exact bytes; filesystem metadata is outside this format. */
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
  readonly entries: readonly [GameBackupArchiveEntry, ...GameBackupArchiveEntry[]]
  readonly treeDigest: string
}
export type GameBackupTreeRow =
  | readonly [path: string, type: 'directory']
  | readonly [path: string, type: 'file', sizeBytes: number, sha256: string]

const sha256Schema = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))
const memberPathSchema = v.pipe(
  v.string(),
  v.check((path) => {
    if (path === '') {
      return true
    }
    if (
      path.startsWith('/') ||
      path.startsWith('\\\\') ||
      /^[a-z]:/i.test(path) ||
      path.includes('\0') ||
      /[\uD800-\uDFFF]/u.test(path)
    ) {
      return false
    }
    return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  }),
)
const archiveEntrySchema: v.GenericSchema<unknown, GameBackupArchiveEntry> = v.union([
  objectSchema({ path: memberPathSchema, type: v.literal('directory') }),
  objectSchema({
    path: memberPathSchema,
    type: v.literal('file'),
    sizeBytes: nonnegativeIntegerSchema,
    sha256: sha256Schema,
  }),
])
const archiveEntriesSchema = v.pipe(
  v.tupleWithRest([archiveEntrySchema], archiveEntrySchema),
  v.check((entries) => hasCompleteTree(entries)),
  v.readonly(),
)
const archiveManifestSchema: v.GenericSchema<unknown, GameBackupArchiveManifest> = objectSchema({
  format: v.literal('kisaki-game-save'),
  formatVersion: v.literal(1),
  entries: archiveEntriesSchema,
  treeDigest: sha256Schema,
})
const encoder = new TextEncoder()

function compareUtf8(left: string, right: string): number {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = a[index]! - b[index]!
    if (difference !== 0) {
      return difference
    }
  }
  return a.length - b.length
}

function hasCompleteTree(entries: readonly GameBackupArchiveEntry[]): boolean {
  const root = entries[0]
  if (!root || root.path !== '') {
    return false
  }
  if (root.type === 'file') {
    return entries.length === 1
  }
  const directories = new Set([''])
  let previous = ''
  for (const entry of entries.slice(1)) {
    if (compareUtf8(previous, entry.path) >= 0) {
      return false
    }
    const separator = entry.path.lastIndexOf('/')
    const parent = separator === -1 ? '' : entry.path.slice(0, separator)
    if (!directories.has(parent)) {
      return false
    }
    if (entry.type === 'directory') {
      directories.add(entry.path)
    }
    previous = entry.path
  }
  return true
}

/** Encode an already sorted, complete tree into the exact UTF-8 JSON used by SHA-256. Empty sources are ordinary trees. */
export function encodeGameBackupTree(
  input: readonly GameBackupArchiveEntry[],
): Uint8Array<ArrayBuffer> {
  const entries = parseContract(archiveEntriesSchema, input, 'game backup content tree')
  const rows: GameBackupTreeRow[] = entries.map((entry) =>
    entry.type === 'directory'
      ? [entry.path, 'directory']
      : [entry.path, 'file', entry.sizeBytes, entry.sha256],
  )
  return encoder.encode(JSON.stringify(rows))
}

/** Hash a complete content tree using the standard Web Crypto API; this does not read or verify file bytes. */
export async function calculateGameBackupTreeDigest(
  entries: readonly GameBackupArchiveEntry[],
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encodeGameBackupTree(entries))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Parse a manifest value. Unsupported formats differ from damaged version-1 data; archive members still need verification. */
export function parseGameBackupArchiveManifest(input: unknown): GameBackupArchiveManifest {
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    if (
      ('format' in input && input.format !== 'kisaki-game-save') ||
      ('formatVersion' in input && input.formatVersion !== 1)
    ) {
      throw new ExecutionError({
        code: 'UnsupportedBackupFormat',
        message: 'The game backup format is not supported.',
      })
    }
  }
  const result = v.safeParse(archiveManifestSchema, input)
  if (!result.success) {
    throw new ExecutionError({
      code: 'DataIntegrityError',
      message: 'The game backup manifest is invalid.',
    })
  }
  return result.output
}

/** Read strict JSON and verify its deterministic tree digest before adopting a manifest. File sizes, bytes, and ZIP membership remain the archive reader's responsibility. */
export async function readGameBackupArchiveManifest(
  text: string,
): Promise<GameBackupArchiveManifest> {
  let input: unknown
  try {
    input = parseJsonDocument(text)
  } catch (cause) {
    throw new ExecutionError(
      { code: 'DataIntegrityError', message: 'The game backup manifest is not valid JSON.' },
      { cause },
    )
  }
  const manifest = parseGameBackupArchiveManifest(input)
  if ((await calculateGameBackupTreeDigest(manifest.entries)) !== manifest.treeDigest) {
    throw new ExecutionError({
      code: 'DataIntegrityError',
      message: 'The game backup content tree digest does not match.',
    })
  }
  return manifest
}

export type RecoveryLocation = 'target' | 'original' | 'prepared' | 'displaced'
export type RecoveryAction = 'continue' | 'rollback' | 'keepCurrent'
export type RecoveryResolution = 'restored' | 'rolledBack' | 'keptCurrent'
export interface GameBackupRestoreInput {
  readonly gameId: string
  readonly backupId: string
  readonly target:
    | { readonly type: 'config'; readonly launchConfigId: string }
    | { readonly type: 'path'; readonly path: string }
}
/** Target facts remain meaningful on failure/cancellation; a null resolution with a recovery ID still requires attention. */
export interface GameBackupRestoreResult {
  readonly backupId: string
  readonly target: { readonly path: string; readonly kind: 'file' | 'directory' }
  readonly targetState: 'restored' | 'preserved' | 'recoveryRequired' | 'keptCurrent'
  readonly protectionBackupId: string | null
  readonly recoveryId: string | null
  readonly recoveryResolution: RecoveryResolution | null
  readonly issues: readonly GameBackupIssue[]
}
/** Immutable recovery evidence identifies actual target bytes, not merely the last attempted phase. */
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
  /** Digest of this inspection's facts; resolve must inspect again and compare it. */
  readonly basis: string
}
export type RecoveryOutcome =
  | { readonly resolution: null; readonly resolvedAt: null }
  | { readonly resolution: RecoveryResolution; readonly resolvedAt: number }
export type GameBackupRecovery = RecoveryOutcome & {
  readonly id: string
  readonly gameId: string
  readonly backupId: string
  readonly protectionBackupId: string | null
  readonly targetPath: string
  readonly targetKind: 'file' | 'directory'
  readonly workspacePath: string
  readonly manifestSha256: string
  readonly createdAt: number
}
export type GameBackupRecoveryDetails = GameBackupRecovery & {
  readonly manifest:
    | { readonly status: 'readable'; readonly value: GameBackupRecoveryManifest }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
}
export interface GameBackupRecoveriesApi {
  /** Read bounded index summaries in descending createdAt/id order without walking save data. */
  list(
    input: ListOptions & { readonly gameId?: string; readonly state?: 'pending' | 'resolved' },
    call?: CallOptions,
  ): Promise<ListResult<GameBackupRecovery>>
  /** Read the index and manifest readability; null means no index, not a damaged manifest. */
  get(recoveryId: string, call?: CallOptions): Promise<GameBackupRecoveryDetails | null>
  /** Observe actual bytes without moving, deleting, or authorizing any material. */
  inspect(recoveryId: string, call?: CallOptions): Promise<GameBackupRecoveryInspection>
  /** Confirm and execute one pending recovery action against a freshly matching basis; failures can carry the actual restore result. */
  resolve(
    input: {
      readonly recoveryId: string
      readonly action: RecoveryAction
      readonly expected: { readonly basis: string }
    },
    call?: CallOptions,
  ): Promise<GameBackupRestoreResult>
  /** Confirm cleanup of verified owned material from a resolved index; an absent index is already complete. */
  remove(recoveryId: string, call?: CallOptions): Promise<void>
}
export interface GameBackupsApi {
  readonly recoveries: GameBackupRecoveriesApi
  /** Read backups for the real game, ordered by creation time and identity. */
  list(gameId: string, options: ListOptions, call?: CallOptions): Promise<ListResult<GameBackup>>
  /** Read one saved backup, or null, checking its game ownership. */
  get(gameId: string, backupId: string, call?: CallOptions): Promise<GameBackup | null>
  /** Read a stable complete source and register its archive before retention cleanup; skipIfUnchanged is always explicit. */
  create(
    gameId: string,
    input: {
      readonly source: GameBackupSource
      readonly skipIfUnchanged: boolean
      readonly reason: 'manual' | 'automatic'
      readonly note?: string | null
    },
    call?: CallOptions,
  ): Promise<GameBackupCreateResult>
  /** Confirm the complete overwrite, protect the original target, then safely restore; cancellation cannot abandon an in-progress replacement. */
  restore(input: GameBackupRestoreInput, call?: CallOptions): Promise<GameBackupRestoreResult>
  /** Protect a saved archive from automatic retention. Repeated locking is unchanged success. */
  lock(gameId: string, backupId: string, call?: CallOptions): Promise<void>
  /** Remove only the retention lock; active recovery references still prevent deletion. */
  unlock(gameId: string, backupId: string, call?: CallOptions): Promise<void>
  /** Save a note against only its optional original note value. */
  updateNote(
    gameId: string,
    backupId: string,
    input: { readonly note: string | null; readonly expected?: { readonly note: string | null } },
    call?: CallOptions,
  ): Promise<void>
  /** Confirm and remove this archive and record, never the current save location. */
  delete(gameId: string, backupId: string, call?: CallOptions): Promise<void>
  /** Invalidate backup/recovery reads after committed changes. */
  onInvalidated(listener: () => void): Disposable
}

const recoveryManifestSchema: v.GenericSchema<unknown, GameBackupRecoveryManifest> = v.pipe(
  objectSchema({
    formatVersion: v.literal(1),
    recoveryId: nonemptyStringSchema,
    gameId: nonemptyStringSchema,
    backupId: nonemptyStringSchema,
    protectionBackupId: v.nullable(nonemptyStringSchema),
    target: objectSchema({ path: nonemptyStringSchema, kind: v.picklist(['file', 'directory']) }),
    before: v.union([
      objectSchema({ type: v.literal('absent') }),
      objectSchema({ type: v.literal('present'), treeDigest: sha256Schema }),
    ]),
    after: objectSchema({ treeDigest: sha256Schema }),
    createdAt: nonnegativeIntegerSchema,
  }),
  v.check((value) =>
    value.before.type === 'absent'
      ? value.protectionBackupId === null
      : value.protectionBackupId !== null,
  ),
)

/** Validate immutable recovery identity and protection consistency; actual paths, ownership, and contents are checked by the recovery owner. */
export function parseGameBackupRecoveryManifest(input: unknown): GameBackupRecoveryManifest {
  return parseContract(recoveryManifestSchema, input, 'game backup recovery manifest')
}
