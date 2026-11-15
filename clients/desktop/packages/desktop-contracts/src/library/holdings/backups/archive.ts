/** @fileoverview Defines and validates canonical game-save archive manifests and logical tree encoding. */

import type { NonEmptyArray } from '../../../operations'
import * as v from 'valibot'
import { text, nonnegativeInteger, parseValue } from '../../../validation'

import { DesktopError } from '../../../errors'

import { compareIdentityText } from '../../../scalar-order'
import { bytesToHex } from '@noble/hashes/utils.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { parseStrictJson } from '../../../json'

/**
 * A file or directory in the logical backup tree, with an empty path for the root.
 *
 * Relative paths preserve source names. Extraction separately checks target-platform
 * representability.
 */
export type GameBackupArchiveEntry =
  | { readonly path: string; readonly type: 'directory' }
  | {
      readonly path: string
      readonly type: 'file'
      readonly sizeBytes: number
      readonly sha256: string
    }

/** A versioned logical archive tree with its canonical content digest. */
export interface GameBackupArchiveManifest {
  readonly format: 'kisaki-game-save'
  readonly formatVersion: 1
  readonly entries: NonEmptyArray<GameBackupArchiveEntry>
  readonly treeDigest: string
}

/**
 * A compact logical-tree row used for deterministic JSON encoding.
 *
 * The encoding is independent of ZIP member order, compression and timestamps.
 */
export type GameBackupTreeRow =
  | readonly [path: string, type: 'directory']
  | readonly [path: string, type: 'file', sizeBytes: number, sha256: string]

/** Lowercase SHA-256 value used by canonical backup content identities. */
export const digest = v.pipe(text, v.regex(/^[0-9a-f]{64}$/))

/**
 * Logical content-tree path, including the empty root, checked before destination-filesystem
 * interpretation.
 */
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

/** Directory identity or file identity with complete byte length and content digest. */
const archiveEntry = v.variant('type', [
  v.strictObject({ path: archivePath, type: v.literal('directory') }),
  v.strictObject({
    path: archivePath,
    type: v.literal('file'),
    sizeBytes: nonnegativeInteger,
    sha256: digest,
  }),
])

/** Checks unique paths, a single valid root and real directory parents for every child. */
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

/** Encodes an already validated and ordered tree as compact UTF-8 JSON rows. */
function encodeOrderedTree(entries: readonly GameBackupArchiveEntry[]): Uint8Array {
  const rows: GameBackupTreeRow[] = entries.map((entry) =>
    entry.type === 'directory'
      ? [entry.path, 'directory']
      : [entry.path, 'file', entry.sizeBytes, entry.sha256],
  )
  return new TextEncoder().encode(JSON.stringify(rows))
}

/**
 * Validates and encodes the complete tree as compact UTF-8 JSON ordered by exact path bytes.
 *
 * The output has no byte-order mark or final newline.
 */
export function encodeGameBackupTree(input: readonly GameBackupArchiveEntry[]): Uint8Array {
  const entries = parseValue(
    v.tupleWithRest([archiveEntry], archiveEntry),
    input,
    'Invalid backup tree',
  )
  validateTree(entries)
  return encodeOrderedTree(entries.toSorted((a, b) => compareIdentityText(a.path, b.path)))
}

/**
 * Computes lowercase SHA-256 of the canonical logical tree.
 *
 * ZIP compression, member order, permissions and timestamps do not affect the digest.
 */
export function gameBackupTreeDigest(entries: readonly GameBackupArchiveEntry[]): string {
  return bytesToHex(sha256(encodeGameBackupTree(entries)))
}

/**
 * Parses a version 1 archive manifest and verifies tree structure, order and digest.
 *
 * Unsupported format identities or versions throw UnsupportedBackupFormat. Invalid version 1
 * content throws DataIntegrityError.
 */
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
      bytesToHex(sha256(encodeOrderedTree(value.entries))) !== value.treeDigest
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

/**
 * Parses strict archive JSON and validates the logical manifest.
 *
 * Malformed JSON, including duplicate decoded keys, is reported as DataIntegrityError.
 */
export function parseGameBackupArchiveJson(source: string): GameBackupArchiveManifest {
  let value: unknown

  try {
    value = parseStrictJson(source)
  } catch (cause) {
    throw new DesktopError('DataIntegrityError', 'Invalid game backup manifest JSON', { cause })
  }

  return parseGameBackupArchiveManifest(value)
}
