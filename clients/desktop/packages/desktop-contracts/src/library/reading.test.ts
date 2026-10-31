/** @fileoverview Verifies source-kind correlation, actual geometry, and annotation target edit boundaries. */

import { expect, it } from 'vitest'
import { parseNormalizedQuad } from '../geometry'
import { parseReadingPosition, parseReadingTextSelection } from './reading'
import { parseAnnotationCreate, parseAnnotationQuery, parseAnnotationUpdate } from './annotations'
import { parseEntryUpdate } from './catalog'
import { parseFileInput } from '../resources'

const quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
] as const

it('requires nondegenerate clockwise quads with a canonical first vertex', () => {
  expect(parseNormalizedQuad(quad)).toEqual(quad)
  expect(() => parseNormalizedQuad([...quad].reverse())).toThrow()
  expect(() => parseNormalizedQuad([quad[0], quad[2], quad[1], quad[3]])).toThrow()
  expect(() => parseNormalizedQuad([quad[0], quad[0], quad[2], quad[3]])).toThrow()
})

it('preserves real source addresses and rejects mixed branches, encodings, empty ranges, and duplicate pages', () => {
  expect(
    parseReadingPosition({ type: 'anchor', anchor: { type: 'xmlNode', nodePath: [] } }),
  ).toMatchObject({ anchor: { nodePath: [] } })
  const start = { type: 'textOffset', encoding: 'utf-8', offset: 0 }
  expect(
    parseReadingTextSelection({ type: 'anchors', start, end: { ...start, offset: 10 } }),
  ).toBeDefined()
  for (const end of [
    start,
    { ...start, encoding: 'utf-16le', offset: 10 },
    { type: 'mobi', byteOffset: 10 },
  ]) {
    expect(() => parseReadingTextSelection({ type: 'anchors', start, end })).toThrow()
  }
  const page = { page: { type: 'pageIndex', index: 0 }, quads: [quad] }
  expect(() => parseReadingTextSelection({ type: 'pages', pages: [page, page] })).toThrow()
  expect(() => parseReadingTextSelection({ type: 'pages', pages: [] })).toThrow()
  expect(() => parseReadingPosition('start')).toThrow()
})

it('keeps whole annotation targets and kind-specific fields separate from independent title changes', () => {
  expect(
    parseAnnotationCreate({
      workType: 'game',
      gameId: 'game',
      target: { imageId: 'image' },
      title: ' ',
    }),
  ).toMatchObject({ title: null })
  expect(() =>
    parseAnnotationCreate({
      workType: 'game',
      gameId: 'game',
      target: { imageId: 'image', location: { type: 'position', positionSeconds: 0 } },
    }),
  ).toThrow()
  expect(() =>
    parseAnnotationCreate({
      workType: 'anime',
      animeId: 'anime',
      target: { fileId: null, location: { type: 'position', positionSeconds: 0 }, imageId: null },
    }),
  ).toThrow()
  expect(
    parseAnnotationUpdate('anime', { changes: { title: 'Title' }, expected: { title: null } }),
  ).toBeDefined()
  expect(() =>
    parseAnnotationUpdate('anime', { changes: { target: { fileId: 'file' } } }),
  ).toThrow()
  expect(() =>
    parseAnnotationUpdate('anime', { changes: { title: 'Title' }, expected: { content: '' } }),
  ).toThrow()
  expect(
    parseAnnotationQuery({ scope: { type: 'library' }, search: '', workTypes: [], refs: [] }),
  ).toMatchObject({ workTypes: [], refs: [] })
})

it('rejects empty arrays and class instances at object boundaries instead of converting them into empty edits', () => {
  for (const changes of [[], new Date(0)]) {
    expect(() => parseEntryUpdate('game', { changes })).toThrow()
  }
  expect(() =>
    parseFileInput({ type: 'url', url: 'https://example.org/image', headers: [] }),
  ).toThrow()
  expect(() =>
    parseFileInput({
      type: 'url',
      url: 'https://example.org/image',
      headers: { Authorization: 'secret' },
    }),
  ).toThrow()
  expect(
    parseFileInput({
      type: 'url',
      url: 'https://example.org/image',
      headers: { authorization: 'secret' },
      redirect: 'error',
    }),
  ).toMatchObject({ redirect: 'error' })
})
