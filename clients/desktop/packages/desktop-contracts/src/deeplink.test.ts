/** @fileoverview Verifies lossless application links, exact positions and rejection of malformed or injected routes. */

import { describe, it, expect } from 'vite-plus/test'

import { parse as parseLink, format as formatLink } from './deeplink'

import { DesktopError } from './errors'

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
