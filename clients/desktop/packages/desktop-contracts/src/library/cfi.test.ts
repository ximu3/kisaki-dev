/** @fileoverview Verifies CFI scalar and exact numeric syntax independently of document content and JavaScript number precision. */

import { expect, test } from 'vite-plus/test'
import { parseCfiPoint } from './cfi'
import { DesktopError } from '../errors'

test('validates XML characters in CFI assertions without rejecting legal whitespace', () => {
  const point = 'epubcfi(/6/2[;custom=章😀\tline\nnext\rfinal])'

  expect(parseCfiPoint(point)).toBe(point)

  for (const value of ['\ufffe', '\uffff']) {
    expect(() => parseCfiPoint(`epubcfi(/6/2[;custom=${value}])`)).toThrow(DesktopError)
  }
})

test('preserves exact numeric tokens before source bounds are known', () => {
  const points = [
    'epubcfi(/6/9007199254740992!/4/2:9007199254740993)',
    `epubcfi(/6/2!/4/2~${'9'.repeat(400)}.1)`,
    'epubcfi(/6/2!/4/2@100:0)',
    'epubcfi(/6/2!/4/2@99.99999999999999999:100)',
  ]

  for (const point of points) {
    expect(parseCfiPoint(point)).toBe(point)
  }
})

test('rejects spatial coordinates above 100 without rounding them into range', () => {
  const coordinates = ['100.00000000000000001:0', '0:100.00000000000000001', '101:0', '0:1000']

  for (const coordinate of coordinates) {
    expect(() => parseCfiPoint(`epubcfi(/6/2!/4/2@${coordinate})`)).toThrow(DesktopError)
  }
})
