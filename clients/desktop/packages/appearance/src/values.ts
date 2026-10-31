/** @fileoverview Validates concrete visual values using CSS grammar without loading a document or desktop resources. */

import { lexer, parse, walk } from 'css-tree'
import { appearanceTokenNames, type AppearanceTokenName, type VisualTokens } from './tokens'

/** A visual editor's value grammar; it has no relationship to desktop font identities. */
export type AppearanceTokenKind =
  | 'color'
  | 'radius'
  | 'shadow'
  | 'opacity'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'

const specializedKinds = {
  '--radius': 'radius',
  '--shadow-raised': 'shadow',
  '--shadow-overlay': 'shadow',
  '--shadow-modal': 'shadow',
  '--pane-alpha': 'opacity',
  '--light-strength': 'opacity',
  '--grain-opacity': 'opacity',
  '--font-sans': 'fontFamily',
  '--font-mono': 'fontFamily',
  '--text-base-size': 'fontSize',
  '--text-base-weight': 'fontWeight',
  '--text-base-line-height': 'lineHeight',
  '--text-base-letter-spacing': 'letterSpacing',
} as const

/** Safe visual input failure. Its message identifies only the known token, not untrusted CSS. */
export class VisualValueError extends Error {
  override readonly name = 'VisualValueError'
  readonly code = 'InvalidInput'
}

/** Return the token's actual CSS value family for a generic editor or validator. */
export function getAppearanceTokenKind(name: AppearanceTokenName): AppearanceTokenKind {
  if (!appearanceTokenNames.includes(name)) {
    throw new VisualValueError('Unknown appearance token.')
  }
  return Object.hasOwn(specializedKinds, name)
    ? specializedKinds[name as keyof typeof specializedKinds]
    : 'color'
}

/** Validate a concrete value, preserving valid syntax rather than rewriting colors or discarding shadow layers. */
export function parseVisualToken(name: AppearanceTokenName, input: unknown): string {
  const kind = getAppearanceTokenKind(name)
  if (typeof input !== 'string' || input.trim() === '') {
    throw new VisualValueError(`Invalid value for ${name}.`)
  }
  try {
    const ast = parse(input, { context: 'value' })
    let invalid = false
    walk(ast, (node) => {
      if (node.type === 'Raw' || node.type === 'Url') {
        invalid = true
      }
    })
    const grammars: Record<Exclude<AppearanceTokenKind, 'fontFamily' | 'shadow'>, string> = {
      color: '<color>',
      radius: '<length-percentage [0,∞]>',
      opacity: '<number [0,1]> | <percentage [0,100]>',
      fontSize: '<length-percentage [0,∞]>',
      fontWeight: 'normal | bold | <number [1,1000]>',
      lineHeight: 'normal | <number [0,∞]> | <length-percentage [0,∞]>',
      letterSpacing: 'normal | <length>',
    }
    const result =
      kind === 'fontFamily' || kind === 'shadow'
        ? lexer.matchProperty(kind === 'fontFamily' ? 'font-family' : 'box-shadow', ast)
        : lexer.match(grammars[kind], ast)
    if (invalid || result.error) {
      throw new VisualValueError(`Invalid value for ${name}.`)
    }
    return input
  } catch (cause) {
    if (cause instanceof VisualValueError) {
      throw cause
    }
    throw new VisualValueError(`Invalid value for ${name}.`, { cause })
  }
}

/** Parse one complete scheme with the exact token vocabulary; font bytes and selection remain host-owned. */
export function parseVisualTokens(input: unknown): Readonly<VisualTokens> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new VisualValueError('A complete visual token object is required.')
  }
  const prototype: unknown = Object.getPrototypeOf(input)
  if (
    (prototype !== null && prototype !== Object.prototype) ||
    Reflect.ownKeys(input).length !== appearanceTokenNames.length ||
    !appearanceTokenNames.every((name) => Object.hasOwn(input, name))
  ) {
    throw new VisualValueError('The appearance token vocabulary does not match.')
  }
  const values = input as Record<AppearanceTokenName, unknown>
  return Object.fromEntries(
    appearanceTokenNames.map((name) => [name, parseVisualToken(name, values[name])]),
  ) as VisualTokens
}
