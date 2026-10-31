/** @fileoverview Checks native routing and lossless extension URL semantics, including adversarial encodings. */

import { expect, it } from 'vitest'
import { format, parse, type DeeplinkRequest } from './deeplink'

it.each<DeeplinkRequest>([
  { type: 'view', target: { type: 'library' } },
  { type: 'view', target: { type: 'person' } },
  { type: 'view', target: { type: 'note', id: '笔记/1' } },
  {
    type: 'view',
    target: {
      type: 'anime',
      identifier: { type: 'external', source: 'bangumi', sourceId: 'subject/123' },
      episodeId: 'episode',
    },
  },
  { type: 'view', target: { type: 'scanner', configId: 'config', runId: 'run' } },
  { type: 'view', target: { type: 'metadataProfiles', profileId: 'profile' } },
  { type: 'view', target: { type: 'extensions', extensionId: 'author.tool', pageId: 'main' } },
  {
    type: 'open',
    target: { type: 'game', identifier: { type: 'local', id: 'game' }, launchConfigId: 'config' },
  },
  {
    type: 'open',
    target: {
      type: 'anime',
      identifier: { type: 'local', id: 'anime' },
      extraId: 'extra',
      fileId: 'file',
      position: 0,
    },
  },
  {
    type: 'open',
    target: {
      type: 'comic',
      identifier: { type: 'local', id: 'comic' },
      volumeId: 'volume',
      chapterId: 'chapter',
      fileId: 'file',
      position: 'start',
    },
  },
  {
    type: 'open',
    target: {
      type: 'novel',
      identifier: { type: 'local', id: 'novel' },
      fileId: 'file',
      position: { type: 'anchor', anchor: { type: 'textOffset', encoding: 'utf-8', offset: 0 } },
    },
  },
  {
    type: 'add',
    entryType: 'game',
    clues: {
      name: 'CLANNAD',
      releaseDate: { year: 2004 },
      externalIdentities: [{ source: 'vndb', sourceId: 'v17' }],
    },
  },
  {
    type: 'add',
    entryType: 'character',
    clues: { birthDate: { month: 2, day: 29 } },
    profileId: 'profile',
  },
  {
    type: 'extension',
    extensionId: 'author.tool',
    path: ['install', '', 'a/b', '%2e', '你好'],
    query: [
      ['name', 'a b+c'],
      ['name', ''],
      ['', 'value'],
    ],
    fragment: '',
  },
])('round-trips the complete $type request in either installed scheme', (request) => {
  expect(parse(format(request))).toEqual(request)
  expect(parse(format(request, 'kisaki-dev'))).toEqual(request)
})

it('uses standard query plus semantics while preserving fragment plus and ordered duplicate pairs', () => {
  expect(parse('kisaki://extension/example/a//b?x=a+b&x=a%2Bb&empty=#a+b')).toEqual({
    type: 'extension',
    extensionId: 'example',
    path: ['a', '', 'b'],
    query: [
      ['x', 'a b'],
      ['x', 'a+b'],
      ['empty', ''],
    ],
    fragment: 'a+b',
  })
  expect(parse('kisaki://extension/example').type).toBe('extension')
  expect(parse('kisaki://extension/example#')).toHaveProperty('fragment', '')
  expect(parse('kisaki://extension/example')).not.toHaveProperty('fragment')
})

it.each([
  'kisaki://extension/example/../another',
  'kisaki://extension/example/%2e/x',
  'kisaki://extension/example/.%2E/x',
  'kisaki://extension/example/%2E./x',
  'kisaki://extension/example/%2e%2e/x',
  'kisaki://extension/a%2Fb/install',
  'kisaki://extension/Example/install',
  'kisaki://user:pass@extension/example',
  'kisaki://@extension/example',
  'kisaki://extension:80/example',
  'kisaki://extension:/example',
  'kisaki://extension/example/%',
  'kisaki://extension/example/%C0%AF',
  'kisaki://extension/example?x=%FF',
  'kisaki://extension/example#%ED%A0%80',
  'kisaki://extension/example/\ud800',
  'kisaki://extension/example?x=\ud800',
  'kisaki://launch/game/local/id',
  'kisaki://open/person/local/id',
  'kisaki://view/preferences?sectionId=theme',
  'kisaki://view/library#',
  'kisaki://view/extensions?pageId=page',
  'kisaki://view/game/local/id?type=person',
  'kisaki://view/note?a=b',
  'kisaki://view/note?id=target',
  'kisaki://view/game/local/id?name=ignored',
  'kisaki://open/anime/local/id?episodeId=e&extraId=x',
  'kisaki://open/novel/local/id?position=%22start%22',
  'kisaki://open/game/local/id?launchConfigId=a&launchConfigId=b',
  'kisaki://open/game/local/id?launchConfigId=',
  'kisaki://add?entryType=game&source=vndb',
  'kisaki://add?entryType=person&releaseDate=%7B%22year%22%3A2000%7D',
  'kisaki://add/game?entryType=game&name=Game',
  'kisaki://add?entryType=game&mode=interactive',
])('rejects malformed or scope-changing URL %s', (url) => {
  expect(() => parse(url)).toThrow(expect.objectContaining({ code: 'InvalidInput' }))
})

it('does not silently drop unsupported data while formatting', () => {
  const invalid = [
    { type: 'extension', extensionId: 'example', path: ['..'], query: [] },
    { type: 'extension', extensionId: 'example', path: [], query: [['x', '\ud800']] },
    {
      type: 'open',
      target: { type: 'game', identifier: { type: 'local', id: 'game' }, fileId: 'file' },
    },
  ]
  for (const request of invalid) {
    expect(() => format(request as DeeplinkRequest)).toThrow()
  }
})
