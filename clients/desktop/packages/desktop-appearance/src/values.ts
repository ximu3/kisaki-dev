/** @fileoverview Parses complete visual values without evaluating formulas or consulting a host. */

import { generate, ident, lexer, parse, walk } from 'css-tree'
import type { CssNode, Value } from 'css-tree'
import { tokens } from './tokens'
import type { TokenKind, TokenName, TokenValues } from './tokens'

const colorSyntax = '<hex-color> | <named-color> | transparent | <color-function>'
const syntaxes: Readonly<Record<TokenKind, string>> = {
  color: colorSyntax,
  radius: '<length [0,∞]>',
  // An explicit color keeps each layer independent of the element's currentColor.
  shadow: `none | [ [${colorSyntax}] && <length>{2,4} && inset? ]#`,
  percentage: '<percentage [0,100]>',
  'font-family': '[ <family-name> | <generic-family> ]#',
  'font-size': '<length [0,∞]>',
  'font-weight': 'normal | bold | <number [1,1000]>',
  'line-height': 'normal | <number [0,∞]> | <length-percentage [0,∞]>',
  'letter-spacing': 'normal | <length>',
}

const colorFunctions = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
])

/** Reject computations even where the CSS grammar treats their result as a numeric value. */
function hasLiteralComponents(value: Value): boolean {
  let valid = true
  walk(value, (node) => {
    if (node.type === 'Function' && !colorFunctions.has(ident.decode(node.name).toLowerCase())) {
      valid = false
    }
    if (node.type === 'Number' || node.type === 'Percentage' || node.type === 'Dimension') {
      if (!Number.isFinite(Number(node.value))) {
        valid = false
      }
    }
    // CSS Tree also recognizes old IE unit hacks; these are not standard visual lengths.
    if (node.type === 'Dimension' && !/^[a-z]+$/i.test(ident.decode(node.unit))) {
      valid = false
    }
    if (!valid) {
      return walk.break
    }
  })
  return valid
}

/** A layer's third length is its blur radius; offsets and spread may remain negative. */
function hasValidShadowBlur(value: Value): boolean {
  let lengthIndex = 0
  for (const node of value.children) {
    if (node.type === 'Operator' && node.value === ',') {
      lengthIndex = 0
    } else if (node.type === 'Number' || node.type === 'Dimension') {
      lengthIndex += 1
      if (lengthIndex === 3 && Number(node.value) < 0) {
        return false
      }
    }
  }
  return true
}

/**
 * Parse one known token into a standalone CSS value, normalizing whitespace and comments.
 * Throws TypeError for an unknown token, wrong value kind, formula, reference or invalid value.
 * Does not resolve fonts, apply styles, convert color spaces or impose a palette.
 */
export function parseTokenValue(name: TokenName, input: unknown): string {
  if (!Object.hasOwn(tokens, name)) {
    throw new TypeError('Unknown appearance token')
  }
  if (typeof input !== 'string') {
    throw new TypeError(`Invalid value for appearance token ${name}`)
  }

  const kind = tokens[name]
  if (lexer.match(syntaxes[kind], input).error) {
    throw new TypeError(`Invalid value for appearance token ${name}`)
  }

  // Match the original text first: parsing alone can repair incomplete CSS functions.
  let ast: CssNode
  try {
    ast = parse(input, { context: 'value' })
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) {
      throw cause
    }
    throw new TypeError(`Invalid value for appearance token ${name}`, { cause })
  }
  if (
    ast.type !== 'Value' ||
    !hasLiteralComponents(ast) ||
    (kind === 'shadow' && !hasValidShadowBlur(ast))
  ) {
    throw new TypeError(`Invalid value for appearance token ${name}`)
  }
  return generate(ast)
}

/**
 * Parse exactly one complete 45-token branch into a new immutable snapshot.
 * Missing or extra keys and invalid values throw TypeError; no defaults are supplied.
 * The input is not modified, and no partially parsed result escapes on failure.
 */
export function parseTokenValues(input: unknown): TokenValues {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Appearance values must be an object')
  }
  const names = Object.keys(tokens) as TokenName[]
  const keys = Object.keys(input)
  if (keys.length !== names.length || keys.some((name) => !Object.hasOwn(tokens, name))) {
    throw new TypeError('Appearance values must contain exactly the base tokens')
  }

  const source = input as Record<string, unknown>
  const entries = names.map((name) => [name, parseTokenValue(name, source[name])])
  return Object.freeze(Object.fromEntries(entries)) as TokenValues
}
