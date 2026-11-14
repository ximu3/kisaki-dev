/** @fileoverview Verifies backup manifest integrity and canonical tree bytes against an independent hash calculation. */

import { test, expect } from 'vite-plus/test'
import { createHash } from 'node:crypto'
import type { GameBackupArchiveEntry } from './archive'

import {
  encodeGameBackupTree,
  gameBackupTreeDigest,
  parseGameBackupArchiveManifest,
  parseGameBackupArchiveJson,
} from './archive'

import { DesktopError } from '../../../errors'

/** Returns an expected DesktopError category while rethrowing unexpected failures. */
function failureCode(operation: () => unknown): string {
  try {
    operation()
  } catch (error) {
    if (error instanceof DesktopError) {
      return error.code
    }

    throw error
  }

  throw new Error('Expected the operation to fail')
}

test('backup tree bytes and digest match an independently constructed ordered UTF-8 representation', () => {
  const hash = createHash('sha256').update(Uint8Array.of(1, 2)).digest('hex')
  const root = { path: '', type: 'directory' } as const
  const file = { path: 'a', type: 'file', sizeBytes: 2, sha256: hash } as const
  const emptyDirectory = { path: 'z', type: 'directory' } as const
  const entries: readonly GameBackupArchiveEntry[] = [root, file, emptyDirectory]
  const expected = JSON.stringify([
    ['', 'directory'],
    ['a', 'file', 2, hash],
    ['z', 'directory'],
  ])

  expect(new TextDecoder().decode(encodeGameBackupTree([...entries].reverse()))).toBe(expected)

  const treeDigest = createHash('sha256').update(expected, 'utf8').digest('hex')

  expect(gameBackupTreeDigest(entries)).toBe(treeDigest)

  const manifest = { format: 'kisaki-game-save', formatVersion: 1, entries, treeDigest }

  expect(parseGameBackupArchiveManifest(manifest)).toEqual(manifest)

  expect(failureCode(() => parseGameBackupArchiveManifest({ ...manifest, formatVersion: 2 }))).toBe(
    'UnsupportedBackupFormat',
  )

  expect(
    failureCode(() =>
      parseGameBackupArchiveManifest({ ...manifest, entries: [root, { ...file, path: '../a' }] }),
    ),
  ).toBe('DataIntegrityError')
  expect(
    failureCode(() =>
      parseGameBackupArchiveJson(
        '{"format":"kisaki-game-save","formatVersion":1,"formatVersion":1}',
      ),
    ),
  ).toBe('DataIntegrityError')
})
