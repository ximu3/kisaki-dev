/** @fileoverview Checks explicit session targets without allowing positions or incompatible choices to be silently dropped. */

import { describe, expect, it } from 'vitest'
import {
  parseAnimeOpenInput,
  parseComicOpenInput,
  parseGameOpenInput,
  parseNovelOpenInput,
} from './sessions'
import {
  createGameLaunchConfigDraft,
  parseGameLaunchConfigFields,
  parseGameLaunchConfigUpdate,
} from './library/launch-configs'
import { parseDirectoryDiscoveryDefinition } from './library/holdings'

describe('session open inputs', () => {
  it('requires an actual file for every explicit position, including start', () => {
    for (const position of [0, 'start']) {
      expect(() => parseAnimeOpenInput({ animeId: 'a', position })).toThrow()
      expect(parseAnimeOpenInput({ animeId: 'a', fileId: 'f', position })).toMatchObject({
        fileId: 'f',
        position,
      })
    }
    expect(() => parseComicOpenInput({ comicId: 'c', position: 'start' })).toThrow()
    expect(() => parseNovelOpenInput({ novelId: 'n', position: 'start' })).toThrow()
    expect(parseNovelOpenInput({ novelId: 'n', fileId: 'f', position: 'start' }).position).toBe(
      'start',
    )
  })

  it('retains simultaneous comic constraints while rejecting mutually exclusive anime parts and invented selection modes', () => {
    expect(
      parseComicOpenInput({ comicId: 'c', volumeId: 'v', chapterId: 'ch', fileId: 'f' }),
    ).toEqual({ comicId: 'c', volumeId: 'v', chapterId: 'ch', fileId: 'f' })
    expect(() => parseAnimeOpenInput({ animeId: 'a', episodeId: 'e', extraId: 'x' })).toThrow()
    expect(() => parseGameOpenInput({ gameId: 'g', resume: true })).toThrow()
  })
})

describe('saved local choices', () => {
  it('retains an explicit incomplete launch choice and applies only documented defaults', () => {
    const config = createGameLaunchConfigDraft('Choice', { type: 'file', path: null })
    expect(config).toMatchObject({
      monitoring: { type: 'directory', path: null },
      backupRetentionCount: 5,
      autoBackupEnabled: false,
      savePath: null,
    })
    expect(() =>
      parseGameLaunchConfigFields({
        ...config,
        launch: { type: 'file', path: '/game', workingDirectory: '/work' },
      }),
    ).toThrow()
    expect(() => parseGameLaunchConfigFields({ ...config, backupRetentionCount: 0 })).toThrow()
    expect(() =>
      parseGameLaunchConfigUpdate({ changes: { name: 'New' }, expected: { note: null } }),
    ).toThrow()
  })

  it('requires complete discovery definitions and positive or unlimited depth', () => {
    expect(
      parseDirectoryDiscoveryDefinition({ maxDepth: null, include: [], exclude: [] }).maxDepth,
    ).toBeNull()
    expect(() =>
      parseDirectoryDiscoveryDefinition({ maxDepth: 0, include: [], exclude: [] }),
    ).toThrow()
    expect(() => parseDirectoryDiscoveryDefinition({ maxDepth: null })).toThrow()
  })
})
