/** @fileoverview Checks declared template captures without executing user patterns. */

import { expect, test } from 'vitest'
import { parseTextTemplate } from './text-rules'

test('text templates reject positional and undeclared capture references', () => {
  expect(() => parseTextTemplate('$1', ['name'])).toThrow()

  expect(() => parseTextTemplate('$<missing>', ['name'])).toThrow()
})
