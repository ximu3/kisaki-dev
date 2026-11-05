/** @fileoverview Checks ICU argument compatibility against an explicit source catalog. */

import { expect, test } from 'vitest'

import { getMessageParameterContract, validateMessageCatalog } from './messages'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

test('intersects all source uses and allows omissions but never a narrowing translation', () => {
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

  expect(() => validateMessageCatalog({ greeting: '{name, number}' }, source)).toThrow(DesktopError)

  expect(() => validateMessageCatalog({ count: '{extra}' }, source)).toThrow(DesktopError)

  expect(() => validateMessageCatalog({ count: '' }, source, { complete: true })).toThrow(
    DesktopError,
  )

  expect(() => validateMessageCatalog({ 'bad.key': 'value' }, source)).toThrow(DesktopError)
})
