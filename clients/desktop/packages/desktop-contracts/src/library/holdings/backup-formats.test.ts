/** @fileoverview Verifies backup formats behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'
import { createHash } from 'node:crypto'
import type { GameBackupArchiveEntry } from './backups'

import {
  encodeGameBackupTree,
  gameBackupTreeDigest,
  parseGameBackupArchiveManifest,
  parseGameBackupArchiveJson,
  parseGameBackupCreateInput,
} from './backup-formats'

import { DesktopError } from '../../errors'

/** Observe the machine category, preserving unexpected implementation errors instead of treating them as expected rejection. */
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

  expect(() =>
    parseGameBackupCreateInput({ source: { type: 'config', launchConfigId: 'config' } }),
  ).toThrow(DesktopError)
})
