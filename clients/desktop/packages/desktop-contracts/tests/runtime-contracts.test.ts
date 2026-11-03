/** @fileoverview Checks cross-entry target, partial-result, preference, deeplink and message contracts. */

import { describe, expect, it } from 'vitest'
import { IntlMessageFormat } from 'intl-messageformat'
import { DesktopError } from '../src/errors'
import { parse as parseLink, format as formatLink } from '../src/deeplink'
import {
  parseAnimeOpenInput,
  parseComicOpenInput,
  parseFileSwitchResult,
  parsePlaybackSettingResult,
  parseRecordingRetryResult,
  parseSessionInteraction,
} from '../src/sessions'
import {
  getPreferencesDefaults,
  parsePreferences,
  parsePreferencesUpdate,
  readPreferences,
  parseAccelerator,
  findShortcutConflicts,
} from '../src/preferences'
import { parseProxyEndpoint } from '../src/network'
import {
  getMessageParameterContract,
  parseUiLocale,
  validateMessageArguments,
  validateMessageCatalog,
} from '../src/i18n'
import { parseSearchResult, truncateSearchExcerpt } from '../src/search'
import { parsePrivateCommit } from '../src/private-data'

describe('actual session targets and partial outcomes', () => {
  it('defaults local interaction to fail and accepts only an explicit operation policy', () => {
    expect(parseSessionInteraction()).toBe('fail')
    expect(parseSessionInteraction('prompt')).toBe('prompt')
    expect(() => parseSessionInteraction(true)).toThrow(DesktopError)
    expect(() => parseAnimeOpenInput({ animeId: 'a', interaction: 'prompt' })).toThrow(DesktopError)
    expect(() => parseLink('kisaki://open/game/local/g?interaction=prompt')).toThrow(DesktopError)
  })
  it('requires a concrete file for start and applies all medium selectors together', () => {
    expect(() => parseAnimeOpenInput({ animeId: 'a', position: 'start' })).toThrow(DesktopError)
    expect(() =>
      parseAnimeOpenInput({ animeId: 'a', fileId: 'f', episodeId: 'e', extraId: 'x' }),
    ).toThrow(DesktopError)
    expect(parseAnimeOpenInput({ animeId: 'a', fileId: 'f', position: 'start' })).toEqual({
      animeId: 'a',
      fileId: 'f',
      position: 'start',
    })
    expect(parseComicOpenInput({ comicId: 'c', volumeId: 'v', chapterId: 'h' })).toEqual({
      comicId: 'c',
      volumeId: 'v',
      chapterId: 'h',
    })
  })
  it('preserves an ended previous file and only reports a saved setting with the actual committed value', () => {
    expect(
      parseFileSwitchResult('anime', {
        outcome: 'previousEnded',
        previousSessionId: 'old',
        targetFileId: 'new',
      }),
    ).toEqual({ outcome: 'previousEnded', previousSessionId: 'old', targetFileId: 'new' })
    expect(
      parsePlaybackSettingResult({
        sessionId: 's',
        animeId: 'a',
        fileId: 'f',
        outcome: 'saved',
        saved: { field: 'subtitleScale', scope: 'work', value: 1.25 },
      }).outcome,
    ).toBe('saved')
    expect(() =>
      parsePlaybackSettingResult({
        sessionId: 's',
        animeId: 'a',
        fileId: 'f',
        outcome: 'saved',
        saved: null,
      }),
    ).toThrow(DesktopError)
    expect(() =>
      parseRecordingRetryResult({
        sessionId: 's',
        savedActivityIds: ['a'],
        remainingActivityIds: ['a'],
        positionSaved: false,
        positionPending: false,
        issues: [],
      }),
    ).toThrow(DesktopError)
  })
})

describe('preference field boundaries', () => {
  it('round trips complete defaults and compares only changed fields, including credential state', () => {
    for (const platform of ['win32', 'darwin', 'linux'] as const) {
      const defaults = getPreferencesDefaults(platform, [{ type: 'native', id: 'library' }])
      expect(parsePreferences(defaults, platform)).toEqual(defaults)
      expect(findShortcutConflicts(defaults.shortcuts, platform)).toEqual([])
    }
    expect(
      parsePreferencesUpdate({
        changes: { navigation: { visibleLimit: 3 } },
        expected: { navigation: { visibleLimit: 7 } },
      }).changes.navigation,
    ).toEqual({ visibleLimit: 3 })
    expect(() =>
      parsePreferencesUpdate({
        changes: { usage: { comic: { text: { fontSize: 22 } } } },
        expected: { usage: { comic: { text: { lineHeight: 2 } } } },
      }),
    ).toThrow(DesktopError)
    expect(() => parsePreferencesUpdate({ changes: { network: { credentials: null } } })).toThrow(
      DesktopError,
    )
    expect(
      parsePreferencesUpdate({
        changes: { network: { credentials: { username: 'name', password: 'secret' } } },
        expected: { network: { credentials: null } },
      }).expected?.network?.credentials,
    ).toBeNull()
  })
  it('defaults only an invalid ordinary field and keeps malformed identities and proxy definitions unavailable', () => {
    const defaults = getPreferencesDefaults('win32', [])
    const value = readPreferences(
      {
        ...defaults,
        library: { showNsfw: 'bad', autoRefreshHoldings: false },
        usage: {
          ...defaults.usage,
          anime: { ...defaults.usage.anime, playbackSpeed: 0, subtitleScale: 2 },
        },
        network: { ...defaults.network, mode: 'manual', endpoint: 'broken' },
        general: {
          ...defaults.general,
          uiTranslation: { type: 'extension', extensionId: 'missing.translation', id: 'zh' },
        },
      },
      defaults,
    )
    expect(value.library).toEqual({ showNsfw: true, autoRefreshHoldings: false })
    expect(value.usage.anime.playbackSpeed).toBe(1)
    expect(value.usage.anime.subtitleScale).toBe(2)
    expect(value.network.status).toBe('invalid')
    expect(value.general.uiTranslation).toEqual({
      status: 'ready',
      value: { type: 'extension', extensionId: 'missing.translation', id: 'zh' },
    })
  })
  it('canonicalizes supported accelerators/endpoints without accepting arbitrary scripts or unsupported proxy auth', () => {
    expect(parseAccelerator('shift+ctrl+s')).toBe('Control+Shift+S')
    expect(parseAccelerator('Control++')).toBe('Control+Plus')
    expect(() => parseAccelerator('Control+Control+A')).toThrow(DesktopError)
    expect(() => parseAccelerator('F25')).toThrow(DesktopError)
    expect(parseProxyEndpoint('HTTP://localhost')).toBe('http://localhost:80')
    expect(() => parseProxyEndpoint('http://user:password@localhost:8080')).toThrow(DesktopError)
    expect(() => parseProxyEndpoint('http://localhost/pac')).toThrow(DesktopError)
  })
})

describe('application link losslessness and closed routes', () => {
  it('round trips root identities, exact positions and ordered repeated extension parameters', () => {
    const examples = [
      'kisaki://view/anime/external/bangumi/subject%2F123?fileId=f',
      'kisaki://open/anime/local/a?fileId=f&position=%22start%22',
      'kisaki://add?entryType=game&name=CLANNAD&releaseDate=%7B%22year%22%3A2004%7D',
      'kisaki-dev://extension/example.ext/a%2Fb//?x=1&x=2&empty=&%2B=a+b#%2B%25',
      'kisaki://extension/example.ext#',
    ]
    for (const url of examples) {
      const parsed = parseLink(url)
      expect(parseLink(formatLink(parsed))).toEqual(parsed)
    }
    expect(parseLink(examples[3]!)).toMatchObject({
      path: ['a/b', '', ''],
      query: [
        ['x', '1'],
        ['x', '2'],
        ['empty', ''],
        ['+', 'a b'],
      ],
      fragment: '+%',
    })
  })
  it('rejects malformed encoding, dot normalization, routing parameter injection and native aliases', () => {
    for (const url of [
      'kisaki://extension/example.ext/%2e%2e/install',
      'kisaki://extension/example.ext/a?x=%FF',
      'kisaki://extension/example.ext/%',
      'kisaki://extension/Example/install',
      'kisaki://view/scanner?type=tasks',
      'kisaki://view/person/local/a?entryType=game',
      'kisaki://view/preferences?sectionId=general',
      'kisaki://open/anime/local/a?position=0',
      'kisaki://open/anime/local/a?fileId=f&fileId=g',
      'kisaki://view/game/local/a#section',
      'kisaki://launch/game/local/a',
      'kisaki://add?entryType=game&source=vndb',
      'kisaki://add?entryType=person&releaseDate=%7B%22year%22%3A2004%7D',
      'kisaki://add?entryType=game&releaseDate=%7B%22year%22%3A2004%7D',
    ]) {
      expect(() => parseLink(url), url).toThrow(DesktopError)
    }
  })
})

describe('ICU author contract', () => {
  it('intersects all source uses and allows omissions but never a narrowing translation', () => {
    expect(getMessageParameterContract('{value} {value, number}')).toEqual({ value: ['number'] })
    expect(() => getMessageParameterContract('{value, number} {value, select, other {x}}')).toThrow(
      DesktopError,
    )
    const source = {
      count: '{count, plural, one {# item} other {# items}}',
      greeting: 'Hello {name}',
    }
    expect(
      validateMessageCatalog({ count: '', greeting: '你好', unknown: '{not parsed' }, source),
    ).toEqual({ count: '', greeting: '你好', unknown: '{not parsed' })
    expect(() => validateMessageCatalog({ greeting: '{name, number}' }, source)).toThrow(
      DesktopError,
    )
    expect(() => validateMessageCatalog({ count: '{extra}' }, source)).toThrow(DesktopError)
    expect(() => validateMessageCatalog({ count: '' }, source, { complete: true })).toThrow(
      DesktopError,
    )
    expect(() => validateMessageCatalog({ 'bad.key': 'value' }, source)).toThrow(DesktopError)
    expect(() => validateMessageArguments(getMessageParameterContract(source.count), {})).toThrow(
      DesktopError,
    )
    expect(parseUiLocale('zh-hans-CN-u-nu-hanidec')).toBe('zh-Hans-CN')
  })
  it('formats actual ICU messages with literal tags and without reparsing interpolated text', () => {
    const message = new IntlMessageFormat(
      '<b>{name}</b>: {count, plural, one {# item} other {# items}}',
      'en',
      undefined,
      { ignoreTag: true },
    )
    expect(message.format({ name: '{count}', count: 2 })).toBe('<b>{count}</b>: 2 items')
  })
})

it('keeps search categories and grapheme-safe excerpt boundaries', () => {
  const item = {
    target: { type: 'collection', id: 'c' },
    title: 'Collection',
    context: null,
    excerpt: null,
    imageId: null,
    icon: null,
  }
  expect(parseSearchResult('catalog', { items: [item], total: 1 }).items).toHaveLength(1)
  expect(() => parseSearchResult('notes', { items: [item], total: 1 })).toThrow(DesktopError)
  expect(truncateSearchExcerpt('a'.repeat(159) + 'e\u0301' + 'x')).toBe('a'.repeat(159))
  expect(truncateSearchExcerpt('a'.repeat(158) + '👨‍👩‍👧‍👦')).toBe('a'.repeat(158))
})

it('keeps private JSON null distinct from deletion and compares only explicitly requested keys', () => {
  const input = {
    values: [{ type: 'set', key: 'state', value: null, expectedRevision: null }],
    secrets: [{ type: 'delete', key: 'state', expectedRevision: 'revision' }],
  }
  expect(parsePrivateCommit(input)).toEqual(input)
  expect(() =>
    parsePrivateCommit({
      values: [
        { type: 'set', key: 'state', value: 1 },
        { type: 'delete', key: 'state' },
      ],
    }),
  ).toThrow(DesktopError)
})
