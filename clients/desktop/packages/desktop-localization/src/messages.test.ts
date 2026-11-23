import { expect, test } from 'vite-plus/test'
import {
  getMessageParameterContract,
  validateMessageArguments,
  validateMessageCatalog,
} from './messages'
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

test('date formats may use numeric timestamps only within the Date range', () => {
  const source = { count: '{count, plural, other {#}}' }
  const narrowed = { count: '{count, plural, other {{count, date, short}}}' }
  expect(() => validateMessageCatalog(narrowed, source)).toThrow(DesktopError)

  const contract = getMessageParameterContract('{value, date} {value, number}')
  expect(contract).toEqual({ value: ['timestamp'] })
  expect(validateMessageArguments(contract, { value: 8.64e15 })).toEqual({ value: 8.64e15 })
  expect(() => validateMessageArguments(contract, { value: 8.64e15 + 1 })).toThrow(DesktopError)
  expect(validateMessageCatalog({ time: '{value, time}' }, { time: '{value, date}' })).toEqual({
    time: '{value, time}',
  })
})
