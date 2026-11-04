/** @fileoverview Verifies accepted visual forms and failures at the public value boundary. */

import { expect, test } from 'vitest'
import { defaults } from './defaults'
import { parseTokenValue, parseTokenValues } from './values'
import type { TokenName } from './tokens'

test('parses literal colors, text metrics, font stacks and complete shadow layers', () => {
  const examples: [TokenName, string][] = [
    ['--primary', 'oklch(0.64 0.17 256 / 0.5)'],
    ['--primary', 'color(display-p3 1 0.2 0 / 80%)'],
    ['--primary', 'rgba(12, 24, 36, 0.5)'],
    ['--primary', 'hsl(200 30% 40%)'],
    ['--primary', '#1234'],
    ['--primary', 'rebeccapurple'],
    ['--input', 'transparent'],
    ['--radius', '0'],
    ['--radius', '0.5rem'],
    ['--text-base-size', '14px'],
    ['--text-base-weight', '450'],
    ['--text-base-weight', 'bold'],
    ['--text-base-line-height', 'normal'],
    ['--text-base-line-height', '150%'],
    ['--text-base-letter-spacing', '-0.01em'],
    ['--text-base-letter-spacing', 'normal'],
    ['--font-sans', '"Library Sans", system-ui, sans-serif'],
    ['--font-mono', '"var(--family)", monospace'],
    ['--shadow-overlay', 'inset 0 1px 0 #fff8, -1px 2px 3px -4px oklch(0 0 0 / .4)'],
    ['--shadow-raised', 'none'],
    ['--pane-alpha', '0%'],
    ['--grain-opacity', '100%'],
  ]

  for (const [token, value] of examples) {
    const parsed = parseTokenValue(token, value)
    expect(parseTokenValue(token, parsed), value).toBe(parsed)
  }

  expect(parseTokenValue('--radius', '  6px /* base */ ')).toBe('6px')
})

test('rejects formulas, context references, invalid kinds and malformed CSS', () => {
  const examples: [TokenName, unknown][] = [
    ['--radius', 'calc(2px + 4px)'],
    ['--radius', 'calc(1px + red)'],
    ['--radius', '\\63 alc(2px + 4px)'],
    ['--radius', 'min(1px, 2px)'],
    ['--radius', 'env(safe-area-inset-top)'],
    ['--radius', 'attr(data-radius px)'],
    ['--primary', 'var(--foreground)'],
    ['--primary', 'rgb(calc(20 + 10) 0 0)'],
    ['--primary', 'color-mix(in oklch, red, blue)'],
    ['--primary', 'rgb(from red r g b)'],
    ['--primary', 'light-dark(white, black)'],
    ['--primary', 'currentColor'],
    ['--primary', 'CanvasText'],
    ['--primary', 'inherit'],
    ['--primary', 'initial'],
    ['--primary', 'red; --background: blue'],
    ['--primary', 'oklch(0.6 0.2 256'],
    ['--primary', 'url(https://example.invalid/color)'],
    ['--primary', '12px'],
    ['--radius', '-1px'],
    ['--radius', '1px 2px'],
    ['--radius', '1px\\9'],
    ['--text-base-size', '-2px'],
    ['--text-base-weight', '1001'],
    ['--text-base-weight', 'bolder'],
    ['--text-base-line-height', '-1'],
    ['--shadow-raised', '0 1px 2px'],
    ['--shadow-raised', '0 1px 2px currentColor'],
    ['--shadow-raised', '0 1px 2px red, inset 0 0 -1px blue'],
    ['--pane-alpha', '101%'],
    ['--pane-alpha', '-1%'],
    ['--pane-alpha', '0.5'],
    ['--radius', '1e999px'],
    ['--primary', 'rgb(1e999 0 0)'],
    ['--radius', 6],
    ['--font-sans', null],
    ['--font-sans', ''],
  ]

  for (const [token, value] of examples) {
    expect(() => parseTokenValue(token, value), String(value)).toThrow(TypeError)
  }
})

test('creates independent immutable complete branches without defaulting or modifying input', () => {
  for (const branch of Object.values(defaults)) {
    const parsed = parseTokenValues(branch)
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(branch).sort())
    expect(parsed).not.toBe(branch)
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(parseTokenValues(parsed)).toEqual(parsed)
  }

  const input = { ...defaults.light, '--radius': ' 0px ' }
  expect(parseTokenValues(input)['--radius']).toBe('0px')
  expect(input['--radius']).toBe(' 0px ')

  const { '--radius': omitted, ...missing } = input
  expect(omitted).toBe(' 0px ')
  for (const invalid of [
    null,
    [],
    {},
    missing,
    { ...input, '--extra': 'red' },
    { ...input, '--radius': 'auto' },
  ]) {
    expect(() => parseTokenValues(invalid)).toThrow(TypeError)
  }
})
