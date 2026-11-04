/** @fileoverview Verifies messages behavior using isolated synthetic inputs. */

import { describe, it, expect } from 'vitest'

import {
  getMessageParameterContract,
  validateMessageCatalog,
  validateMessageArguments,
} from './messages'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

import { parseUiLocale } from '@kisaki3/desktop-contracts/i18n'
import { IntlMessageFormat } from 'intl-messageformat'

describe('ICU author contract', () => {
  it('intersects all source uses and allows omissions but never a narrowing translation', () => {
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

    expect(() => validateMessageCatalog({ greeting: '{name, number}' }, source)).toThrow(
      DesktopError,
    )

    expect(() => validateMessageCatalog({ count: '{extra}' }, source)).toThrow(DesktopError)

    expect(() => validateMessageCatalog({ count: '' }, source, { complete: true })).toThrow(
      DesktopError,
    )

    expect(() => validateMessageCatalog({ 'bad.key': 'value' }, source)).toThrow(DesktopError)

    expect(() => validateMessageArguments(getMessageParameterContract(source.count), {})).toThrow(
      DesktopError,
    )
    expect(parseUiLocale('zh-hans-CN-u-nu-hanidec')).toBe('zh-Hans-CN')
  })

  it('formats actual ICU messages with literal tags and without reparsing interpolated text', () => {
    const message = new IntlMessageFormat(
      '<b>{name}</b>: {count, plural, one {# item} other {# items}}',
      'en',
      undefined,
      { ignoreTag: true },
    )

    expect(message.format({ name: '{count}', count: 2 })).toBe('<b>{count}</b>: 2 items')
  })
})
