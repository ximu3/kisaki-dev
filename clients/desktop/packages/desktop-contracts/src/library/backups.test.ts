/** @fileoverview Verifies exact archive trees, empty-state handling, and damaged manifest rejection. */

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ExecutionError } from '../errors'
import {
  calculateGameBackupTreeDigest,
  encodeGameBackupTree,
  parseGameBackupArchiveManifest,
  parseGameBackupRecoveryManifest,
  readGameBackupArchiveManifest,
  type GameBackupArchiveEntry,
} from './backups'

const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

describe('game backup content trees', () => {
  it('retains empty roots, nested empty directories, and zero-byte files without a special result flag', async () => {
    const entries: GameBackupArchiveEntry[] = [
      { path: '', type: 'directory' },
      { path: 'empty', type: 'directory' },
      { path: 'empty/marker', type: 'file', sizeBytes: 0, sha256: emptyHash },
    ]
    const encoded = encodeGameBackupTree(entries)
    expect(new TextDecoder().decode(encoded)).toBe(
      `[["","directory"],["empty","directory"],["empty/marker","file",0,"${emptyHash}"]]`,
    )
    const treeDigest = createHash('sha256').update(encoded).digest('hex')
    expect(
      await readGameBackupArchiveManifest(
        JSON.stringify({ format: 'kisaki-game-save', formatVersion: 1, entries, treeDigest }),
      ),
    ).toEqual({ format: 'kisaki-game-save', formatVersion: 1, entries, treeDigest })
    expect(encodeGameBackupTree([{ path: '', type: 'directory' }])).not.toEqual(
      encodeGameBackupTree([{ path: '', type: 'file', sizeBytes: 0, sha256: emptyHash }]),
    )
  })

  it('preserves Unicode spelling and follows UTF-8 ordering instead of UTF-16 ordering', () => {
    const entries: GameBackupArchiveEntry[] = [
      { path: '', type: 'directory' },
      { path: '\uE000', type: 'directory' },
      { path: '😀', type: 'directory' },
    ]
    expect(new TextDecoder().decode(encodeGameBackupTree(entries))).toContain('😀')
    expect(() => encodeGameBackupTree([entries[0]!, entries[2]!, entries[1]!])).toThrow(
      ExecutionError,
    )
  })

  it.each(['../save', '/save', 'C:/save', 'folder//save', 'folder/./save', 'broken\uD800'])(
    'rejects invalid member %s',
    (path) => {
      expect(() =>
        encodeGameBackupTree([
          { path: '', type: 'directory' },
          { path, type: 'directory' },
        ]),
      ).toThrow(ExecutionError)
    },
  )

  it('rejects absent roots, missing parents, duplicate paths, and children of a file', () => {
    const invalidTrees: GameBackupArchiveEntry[][] = [
      [],
      [{ path: 'root', type: 'directory' }],
      [
        { path: '', type: 'directory' },
        { path: 'missing/child', type: 'directory' },
      ],
      [
        { path: '', type: 'directory' },
        { path: '', type: 'directory' },
      ],
      [
        { path: '', type: 'file', sizeBytes: 0, sha256: emptyHash },
        { path: 'child', type: 'directory' },
      ],
    ]
    for (const entries of invalidTrees) {
      expect(() => encodeGameBackupTree(entries)).toThrow(ExecutionError)
    }
  })

  it('distinguishes unsupported versions from malformed or altered version-1 manifests', async () => {
    const entries: GameBackupArchiveEntry[] = [{ path: '', type: 'directory' }]
    const manifest = {
      format: 'kisaki-game-save',
      formatVersion: 1,
      entries,
      treeDigest: await calculateGameBackupTreeDigest(entries),
    }
    expect(() => parseGameBackupArchiveManifest({ ...manifest, formatVersion: 2 })).toThrow(
      expect.objectContaining({ code: 'UnsupportedBackupFormat' }),
    )
    expect(() => parseGameBackupArchiveManifest({ ...manifest, extra: true })).toThrow(
      expect.objectContaining({ code: 'DataIntegrityError' }),
    )
    await expect(
      readGameBackupArchiveManifest(JSON.stringify({ ...manifest, treeDigest: emptyHash })),
    ).rejects.toMatchObject({ code: 'DataIntegrityError' })
    await expect(
      readGameBackupArchiveManifest(
        JSON.stringify(manifest).replace(
          '"formatVersion":1',
          '"formatVersion":2,"formatVersion":1',
        ),
      ),
    ).rejects.toMatchObject({ code: 'DataIntegrityError' })
    await expect(
      readGameBackupArchiveManifest('\uFEFF' + JSON.stringify(manifest)),
    ).rejects.toMatchObject({ code: 'DataIntegrityError' })
  })

  it('distinguishes an absent prior target from an existing empty target with a protection backup', () => {
    const manifest = {
      formatVersion: 1,
      recoveryId: 'r',
      gameId: 'g',
      backupId: 'b',
      protectionBackupId: null,
      target: { path: 'C:/saves/game', kind: 'directory' },
      before: { type: 'absent' },
      after: { treeDigest: emptyHash },
      createdAt: 1,
    }
    expect(parseGameBackupRecoveryManifest(manifest).before.type).toBe('absent')
    expect(() =>
      parseGameBackupRecoveryManifest({
        ...manifest,
        before: { type: 'present', treeDigest: emptyHash },
      }),
    ).toThrow(ExecutionError)
    expect(
      parseGameBackupRecoveryManifest({
        ...manifest,
        protectionBackupId: 'protection',
        before: { type: 'present', treeDigest: emptyHash },
      }).before.type,
    ).toBe('present')
  })
})
