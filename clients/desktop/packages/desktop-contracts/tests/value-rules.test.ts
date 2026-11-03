/** @fileoverview Checks persistent fact distinctions, ordering, resource inputs and deterministic backup content encoding. */

import { expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import { DesktopError } from '../src/errors'
import { parseFileInput, parsePreparedAttachment } from '../src/resources'
import { parseNormalizedQuad, parseNormalizedRect } from '../src/geometry'
import { parseFontFileMetadata } from '../src/fonts'
import { parseCompletionCreateMany, parseRecordCurrentMany } from '../src/library/completions'
import { activityDurationInRange, parseActivityCreate } from '../src/library/activities'
import { moveWithinOrder, reorderSubset } from '../src/library/ordering'
import {
  encodeGameBackupTree,
  gameBackupTreeDigest,
  parseGameBackupArchiveJson,
  parseGameBackupArchiveManifest,
  parseGameBackupCreateInput,
} from '../src/library/backup-formats'
import type { GameBackupArchiveEntry } from '../src/library/backups'
import {
  extractWorkClues,
  getClueExtractionPresets,
  parseClueExtractionRule,
} from '../src/scanner/rules'
import { parseRecognitionResult } from '../src/scanner'

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

test('history insertion preserves separate facts while current-completion intent coalesces equivalent works', () => {
  const first = {
    work: { type: 'game', id: 'g' },
    completedDate: { year: 2026, month: 11, day: 3 },
    note: '  ',
  }
  const second = { ...first, expected: { completionCount: 2 } }

  expect(parseCompletionCreateMany([first, second])).toHaveLength(2)

  expect(parseRecordCurrentMany([first, second])).toEqual([{ ...second, note: null }])

  expect(() =>
    parseCompletionCreateMany([{ ...first, expected: { completionCount: 1 } }, second]),
  ).toThrow(DesktopError)

  expect(() => parseRecordCurrentMany([first, { ...first, note: 'Different fact' }])).toThrow(
    DesktopError,
  )
})

test('activity ranges allocate the recorded duration and do not apply manual future checks to historical reads', () => {
  const activity = { startedAt: 1000, endedAt: 5000, durationMs: 2000 }

  expect(activityDurationInRange(activity, { from: 1000, to: 3000 })).toBe(1000)

  expect(activityDurationInRange(activity, { from: 5000, to: 6000 })).toBe(0)

  expect(() =>
    parseActivityCreate({ work: { type: 'novel', id: 'n' }, ...activity }, 4000),
  ).toThrow(DesktopError)

  expect(
    parseActivityCreate({ work: { type: 'novel', id: 'n' }, ...activity }, 5000),
  ).not.toHaveProperty('context')

  expect(() =>
    parseActivityCreate(
      {
        work: { type: 'novel', id: 'n' },
        ...activity,
        context: { fileId: null, part: { type: 'comicChapter', id: 'c' } },
      },
      5000,
    ),
  ).toThrow(DesktopError)
})

test('subset reorder preserves other slots while current-position moves fail on a stale anchor', () => {
  const current = ['a', 'b', 'c', 'd', 'e']

  expect(reorderSubset(current, { order: ['e', 'b'], expected: { order: current } })).toEqual([
    'a',
    'e',
    'c',
    'd',
    'b',
  ])

  expect(moveWithinOrder(current, { ids: ['d', 'b'], before: 'a' })).toEqual([
    'd',
    'b',
    'a',
    'c',
    'e',
  ])

  expect(
    failureCode(() =>
      reorderSubset(current, { order: ['e', 'b'], expected: { order: ['a', 'b', 'c', 'e', 'd'] } }),
    ),
  ).toBe('Conflict')

  expect(failureCode(() => moveWithinOrder(current, { ids: ['b'], before: 'missing' }))).toBe(
    'InvalidReference',
  )
  expect(current).toEqual(['a', 'b', 'c', 'd', 'e'])
})

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

test('resource inputs preserve legal headers and real holds while rejecting credential redirects and URL user information', async () => {
  const headers = Object.fromEntries([
    ['constructor', 'value'],
    ['__proto__', 'retained'],
  ])

  expect(parseFileInput({ type: 'url', url: 'https://example.test/file', headers })).toEqual({
    type: 'url',
    url: 'https://example.test/file',
    headers,
  })

  expect(() =>
    parseFileInput({
      type: 'url',
      url: 'https://example.test/file',
      headers: { aUtHoRiZaTiOn: 'Bearer synthetic' },
    }),
  ).toThrow(DesktopError)

  expect(
    parseFileInput({
      type: 'url',
      url: 'https://example.test/file',
      headers: { Cookie: 'synthetic=1' },
      redirect: 'error',
    }),
  ).toMatchObject({ redirect: 'error' })

  expect(() =>
    parseFileInput({ type: 'url', url: 'https://user:password@example.test/file' }),
  ).toThrow(DesktopError)

  let released = false
  const prepared = {
    attachmentId: 'prepared',
    resource: { id: 'resource' },
    async dispose() {
      released = true
    },
  }

  expect(parsePreparedAttachment(prepared)).toBe(prepared)
  expect(released).toBe(false)

  await prepared.dispose()

  expect(released).toBe(true)
})

test('source geometry and font metadata reject degenerate or contradictory values without clamping', () => {
  const quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]

  expect(parseNormalizedQuad(quad)).toEqual(quad)

  expect(() => parseNormalizedQuad([...quad].reverse())).toThrow(DesktopError)

  expect(() => parseNormalizedRect({ x: 0.9, y: 0, width: 0.2, height: 1 })).toThrow(DesktopError)

  const metric = { min: 100, default: 400, max: 900 }
  const metadata = {
    faces: [
      {
        index: 0,
        family: 'Synthetic',
        subfamily: 'Regular',
        fullName: null,
        postScriptName: null,
        weight: metric,
        width: { min: 100, default: 100, max: 100 },
        style: 'normal',
        axes: [{ tag: 'wght', ...metric }],
      },
    ],
  }

  expect(parseFontFileMetadata(metadata)).toEqual(metadata)

  expect(() =>
    parseFontFileMetadata({
      faces: [{ ...metadata.faces[0], weight: { min: 900, default: 400, max: 100 } }],
    }),
  ).toThrow(DesktopError)
})

test('scanner presets are opt-in single-pass rules and recognizers must contribute actual new clues', () => {
  const examples = [
    '[A] Name [B]',
    '[A] [B] Name',
    'Name (2004)',
    'Name_v1.2',
    'Name_JP',
    '[A] Name',
    '(A) Name',
    'Name [B]',
    'Name (B)',
  ]
  const presets = getClueExtractionPresets()
  for (const [index, preset] of presets.entries()) {
    const rule = parseClueExtractionRule({
      ...preset.rule,
      id: preset.id,
      name: String(preset.name),
    })

    const result = extractWorkClues([rule], {
      baseName: examples[index]!,
      relativePath: examples[index]!,
    })

    expect(result.clues.name).toBe('Name')
    expect(result.ruleId).toBe(preset.id)
  }

  expect(
    extractWorkClues([], { baseName: 'Original_name', relativePath: 'dir/Original_name' }).clues,
  ).toEqual({ name: 'Original_name' })

  const input = {
    entryType: 'game' as const,
    path: '/fixture/game',
    kind: 'directory' as const,
    clues: { name: 'Name' },
  }

  expect(parseRecognitionResult(input, null)).toBeNull()

  expect(() => parseRecognitionResult(input, { name: '  NAME  ' })).toThrow(DesktopError)

  expect(
    parseRecognitionResult(input, { externalIdentities: [{ source: 'vndb', sourceId: 'v17' }] }),
  ).toEqual({ externalIdentities: [{ source: 'vndb', sourceId: 'v17' }] })
})
