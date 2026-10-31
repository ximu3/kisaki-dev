/** @fileoverview Checks complete visual schemes and native CSS grammar beyond literal color examples. */

import { expect, it } from 'vitest'
import { defaultDarkTokens, defaultLightTokens } from './defaults'
import { parseVisualToken, parseVisualTokens } from './values'

it('accepts both complete default schemes without changing their values', () => {
  expect(parseVisualTokens(defaultLightTokens)).toEqual(defaultLightTokens)
  expect(parseVisualTokens(defaultDarkTokens)).toEqual(defaultDarkTokens)
  expect(() => parseVisualTokens({ ...defaultLightTokens, '--unknown': 'red' })).toThrow()
  expect(() => parseVisualTokens({ '--background': 'white' })).toThrow()
})

it('preserves modern color, alpha, normal spacing, zero radius, and multilayer shadows', () => {
  expect(parseVisualToken('--primary', 'oklch(60% 0.15 260 / 80%)')).toBe(
    'oklch(60% 0.15 260 / 80%)',
  )
  expect(parseVisualToken('--radius', '0')).toBe('0')
  expect(parseVisualToken('--text-base-letter-spacing', 'normal')).toBe('normal')
  expect(parseVisualToken('--text-base-letter-spacing', '-0.01em')).toBe('-0.01em')
  expect(parseVisualToken('--shadow-modal', '0 2px 4px #0003, inset 0 0 1px white')).toBe(
    '0 2px 4px #0003, inset 0 0 1px white',
  )
  expect(parseVisualToken('--font-sans', '"Source Han Sans", system-ui, sans-serif')).toBe(
    '"Source Han Sans", system-ui, sans-serif',
  )
})

it('refuses wrong value families and style/resource injection without truncating input', () => {
  for (const value of [
    '12px',
    'red; background: url(https://example.org)',
    'url(https://example.org)',
    'not-a-color',
  ]) {
    expect(() => parseVisualToken('--primary', value)).toThrow()
  }
  for (const value of ['-1px', '3px 5px']) {
    expect(() => parseVisualToken('--radius', value)).toThrow()
  }
  for (const value of ['1.1', '-0.1', '101%']) {
    expect(() => parseVisualToken('--pane-alpha', value)).toThrow()
  }
})
