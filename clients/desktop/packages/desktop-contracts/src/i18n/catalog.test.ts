/** @fileoverview Verifies real ICU argument constraints, compatible translations, and generated author types. */

import { expect, it } from 'vitest'
import { compileMessageContract, validateTranslation } from './catalog'
import { generateMessages } from '../../tools/generate-messages'

it('derives required argument types from ICU uses and preserves literal HTML-like text', () => {
  const contract = compileMessageContract({
    plain: 'Hello {name}',
    count: '{count, plural, one {One} other {# items}}',
    date: '{when, date, short}',
    choice: '{kind, select, first {First} other {Other}}',
    literal: '<strong>Literal</strong>',
    merged: '{value} {value, number}',
  })
  expect(contract).toEqual({
    plain: { name: 'text' },
    count: { count: 'number' },
    date: { when: 'date' },
    choice: { kind: 'string' },
    literal: {},
    merged: { value: 'number' },
  })
  expect(() => compileMessageContract({ invalid: '{x, date} {x, select, other {Text}}' })).toThrow()
})

it('accepts omissions and broader translated uses, but refuses unknown parameters and narrower types', () => {
  const base = { plain: 'Hello {name}', count: '{count, number}', date: '{when, date}' }
  validateTranslation(base, { count: '{count}', ignored: '{future' })
  validateTranslation(
    base,
    { plain: '', count: '{count, plural, other {#}}', date: '{when, time}' },
    { complete: true },
  )
  expect(() => validateTranslation(base, { plain: '{name, number}' })).toThrow()
  expect(() => validateTranslation(base, { date: '{when}' })).toThrow()
  expect(() => validateTranslation(base, { count: '{unknown}' })).toThrow()
  expect(() => validateTranslation(base, { count: '{count' })).toThrow()
  expect(() => validateTranslation(base, {}, { complete: true })).toThrow()
})

it('rejects non-catalog structures and verifies generated source from the actual English catalog', async () => {
  expect(() => compileMessageContract({ 'invalid.key': 'Text' })).toThrow()
  await generateMessages(true)
})
