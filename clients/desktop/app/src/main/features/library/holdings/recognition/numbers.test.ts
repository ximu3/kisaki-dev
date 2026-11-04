/** @fileoverview Verifies numbers behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { fileNumberKey } from '@kisaki3/desktop-contracts/library'
import { applyFileNumberOffset, expandFileNumberRange } from './numbers'

test('number offsets preserve dotted text and use exact integer arithmetic', () => {
  expect(fileNumberKey(' 003 ')).toBe('3')
  expect(fileNumberKey('1.10')).not.toBe(fileNumberKey('1.1'))

  expect(applyFileNumberOffset('013.10', 0)).toBe('013.10')
  expect(applyFileNumberOffset('013.10', 12)).toBe('1.10')
  expect(applyFileNumberOffset('900719925474099300', -1)).toBe('900719925474099301')
  expect(() => applyFileNumberOffset('SP13', 1)).toThrow()
  expect(() => applyFileNumberOffset('1', 2)).toThrow()

  expect(expandFileNumberRange('01', '03', 3)).toEqual(['1', '2', '3'])
  expect(() => expandFileNumberRange('1', '900719925474099300', 100)).toThrow()
})
