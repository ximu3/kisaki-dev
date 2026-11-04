/** @fileoverview Verifies text patterns behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { matchTextPattern, expandTextTemplate } from './text-patterns'
import { inspectTextPattern, parseTextTemplate } from '@kisaki3/desktop-contracts/text-rules'

test('complete matching backtracks alternatives and rejects a final newline skipped by dollar anchors', () => {
  expect(matchTextPattern(inspectTextPattern('(?<name>a|ab)', false), 'ab')).toEqual({ name: 'ab' })
  expect(matchTextPattern(inspectTextPattern('(?<name>.+)$', false), 'book\n')).toBeNull()
  expect(matchTextPattern(inspectTextPattern('(?<name>[\\s\\S]+)', false), 'book\n')).toEqual({
    name: 'book\n',
  })

  expect(() => parseTextTemplate('$1', ['name'])).toThrow()

  expect(() => parseTextTemplate('$<missing>', ['name'])).toThrow()

  expect(expandTextTemplate('prefix-$<missing>', {})).toBeUndefined()

  expect(expandTextTemplate('prefix-$<name>$$', { name: '' })).toBe('prefix-$')
})
