/** @fileoverview Verifies field processor results retain key coverage and valid partial outcomes. */

import { test, expect } from 'vite-plus/test'
import { parseFieldProcessingInput, parseFieldProcessingResult } from './processors'

test('processor results cannot smuggle fields, omit complete items or replace failure with source values', () => {
  const input = parseFieldProcessingInput({
    items: [
      {
        key: 'a',
        field: { object: 'entry', entryType: 'anime', field: 'name' },
        value: 'Original',
      },
      { key: 'b', field: { object: 'entry', entryType: 'anime', field: 'isNsfw' }, value: false },
    ],
  })

  expect(parseFieldProcessingResult(input, { a: 'Processed', b: false })).toEqual({
    a: 'Processed',
    b: false,
  })

  expect(parseFieldProcessingResult(input, { a: 'Processed' }, 'partial')).toEqual({
    a: 'Processed',
  })

  expect(() => parseFieldProcessingResult(input, { a: 'Processed' })).toThrow()

  expect(() => parseFieldProcessingResult(input, { a: 'Processed', b: 'false' })).toThrow()

  expect(() => parseFieldProcessingResult(input, { a: 'Processed', b: false, extra: 0 })).toThrow()
})
