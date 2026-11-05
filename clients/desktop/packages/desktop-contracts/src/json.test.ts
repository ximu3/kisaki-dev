/** @fileoverview Checks strict JSON retains unique decoded keys and dense arrays. */

import { expect, test } from 'vitest'
import { parseStrictJson, parseJsonValue } from './json'
import { DesktopError } from './errors'

test('JSON values reject duplicate decoded keys and sparse arrays', () => {
  expect(() => parseStrictJson('{"a":1,"\\u0061":2}')).toThrow(DesktopError)

  const sparse: number[] = []

  sparse.length = 2

  sparse[1] = 1

  expect(() => parseJsonValue(sparse)).toThrow(DesktopError)
})
