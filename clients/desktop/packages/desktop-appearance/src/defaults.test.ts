import { expect, test } from 'vite-plus/test'
import { defaults } from './defaults'
import { tokens } from './tokens'

test('both defaults provide the fixed vocabulary without sharing mutable state', () => {
  expect(Object.keys(tokens)).toHaveLength(42)
  for (const values of Object.values(defaults)) {
    expect(Object.keys(values).sort()).toEqual(Object.keys(tokens).sort())
    expect(Object.isFrozen(values)).toBe(true)
    expect(values['--font-sans']).toContain('sans-serif')
    expect(values['--font-mono']).toContain('monospace')
  }
  expect(defaults.light['--background']).not.toBe(defaults.dark['--background'])
})
