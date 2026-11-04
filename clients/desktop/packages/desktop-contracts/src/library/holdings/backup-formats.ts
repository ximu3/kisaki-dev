/** @fileoverview Validates backup receipts and hashes their deterministic logical content independently of ZIP bytes. */

import * as v from 'valibot'
import { text, id, nonnegativeInteger, parseValue, timestamp } from '../../validation'
import { parseAbsolutePath } from '../../paths'
import type {
  GameBackupArchiveEntry,
  GameBackupTreeRow,
  GameBackupArchiveManifest,
  GameBackupSource,
  GameBackupCreateInput,
  GameBackupRestoreInput,
  GameBackupRecoveryManifest,
  GameBackupRecoveryProgress,
  GameBackupRecovery,
  RecoveryLocation,
  RecoveryLocationObservation,
  GameBackupRestoreResult,
} from './backups'
import { DesktopError, parseErrorSummary } from '../../errors'
import { compareIdentityText } from '../../text'
import { bytesToHex } from '@noble/hashes/utils.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { parseStrictJson } from '../../json'

const digest = v.pipe(text, v.regex(/^[0-9a-f]{64}$/))

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

const kind = v.picklist(['file', 'directory'])

const resolution = v.picklist(['restored', 'rolledBack', 'keptCurrent'])

const backupSource = v.variant('type', [
  v.strictObject({ type: v.literal('config'), launchConfigId: id }),
  v.strictObject({ type: v.literal('snapshot'), launchConfigId: id, launchConfigName: text, path }),
])

const archivePath = v.pipe(
  text,
  v.check(
    (value) =>
      value === '' ||
      (!value.includes('\0') &&
        !value.startsWith('\\') &&
        !/^[A-Za-z]:/.test(value) &&
        value.split('/').every((part) => part !== '' && part !== '.' && part !== '..')),
  ),
)

const archiveEntry = v.variant('type', [
  v.strictObject({ path: archivePath, type: v.literal('directory') }),
  v.strictObject({
    path: archivePath,
    type: v.literal('file'),
    sizeBytes: nonnegativeInteger,
    sha256: digest,
  }),
])

function validateTree(entries: readonly GameBackupArchiveEntry[]): void {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]))
  const root = byPath.get('')
  if (byPath.size !== entries.length || !root || (root.type === 'file' && entries.length !== 1)) {
    throw new DesktopError(
      'InvalidInput',
      'Backup tree must have exactly one root and unique paths',
    )
  }

  for (const entry of entries) {
    if (entry.path === '') {
      continue
    }

    const separator = entry.path.lastIndexOf('/')
    const parent = separator < 0 ? '' : entry.path.slice(0, separator)
    if (byPath.get(parent)?.type !== 'directory') {
      throw new DesktopError('InvalidInput', 'Backup tree is missing a real parent directory')
    }
  }
}

/** Encode root and every member as compact UTF-8 JSON rows ordered by exact path bytes, without BOM or final newline. */
export function encodeGameBackupTree(input: readonly GameBackupArchiveEntry[]): Uint8Array {
  const entries = parseValue(
    v.tupleWithRest([archiveEntry], archiveEntry),
    input,
    'Invalid backup tree',
  )
  validateTree(entries)

  const rows: GameBackupTreeRow[] = [...entries]
    .sort((a, b) => compareIdentityText(a.path, b.path))
    .map((entry) =>
      entry.type === 'directory'
        ? [entry.path, 'directory']
        : [entry.path, 'file', entry.sizeBytes, entry.sha256],
    )

  return new TextEncoder().encode(JSON.stringify(rows))
}

/** Hash logical content only; ZIP compression, member order, permissions and timestamps do not affect this digest. */
export function gameBackupTreeDigest(entries: readonly GameBackupArchiveEntry[]): string {
  return bytesToHex(sha256(encodeGameBackupTree(entries)))
}

/** Reject unsupported identities/versions distinctly from a corrupt manifest claiming version 1. */
export function parseGameBackupArchiveManifest(input: unknown): GameBackupArchiveManifest {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('format' in input) ||
    input.format !== 'kisaki-game-save' ||
    !('formatVersion' in input) ||
    input.formatVersion !== 1
  ) {
    throw new DesktopError('UnsupportedBackupFormat', 'Unsupported game backup archive format')
  }

  try {
    const value = parseValue(
      v.strictObject({
        format: v.literal('kisaki-game-save'),
        formatVersion: v.literal(1),
        entries: v.tupleWithRest([archiveEntry], archiveEntry),
        treeDigest: digest,
      }),
      input,
    )
    validateTree(value.entries)
    if (
      value.entries.some(
        (entry, index) =>
          index > 0 && compareIdentityText(value.entries[index - 1]!.path, entry.path) >= 0,
      ) ||
      gameBackupTreeDigest(value.entries) !== value.treeDigest
    ) {
      throw new DesktopError('InvalidInput', 'Backup tree order or content digest does not match')
    }

    return value
  } catch (cause) {
    throw new DesktopError('DataIntegrityError', 'Invalid version 1 game backup manifest', {
      cause,
    })
  }
}

/** Read strict manifest JSON, including duplicate-key and Unicode checks, before validating the logical content. */
export function parseGameBackupArchiveJson(source: string): GameBackupArchiveManifest {
  let value: unknown

  try {
    value = parseStrictJson(source)
  } catch (cause) {
    throw new DesktopError('DataIntegrityError', 'Invalid game backup manifest JSON', { cause })
  }

  return parseGameBackupArchiveManifest(value)
}

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
