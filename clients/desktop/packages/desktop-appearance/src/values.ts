// oxlint-disable-next-line typescript/triple-slash-reference -- CSS Tree's browser entry shares the root declarations.
/// <reference path="./css-tree.d.ts" />

import {
  generate,
  ident,
  lexer,
  parse,
  tokenize,
  tokenTypes,
  walk,
} from 'css-tree/dist/csstree.esm'
import type { CssNode, Value } from 'css-tree'
import { tokens } from './tokens'
import type { TokenKind, TokenName, TokenValues } from './tokens'

/** Standalone color grammar that excludes inherited and context-dependent token values. */
const colorSyntax = '<hex-color> | <named-color> | transparent | <color-function>'

const syntaxes: Readonly<Record<TokenKind, string>> = {
  color: colorSyntax,
  radius: '<length [0,∞]>',
  // An explicit color keeps each layer independent of the element's currentColor.
  shadow: `none | [ [${colorSyntax}] && <length>{2,4} && inset? ]#`,
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

function decodeColorTokens(source: string): string | undefined {
  let normalized = ''
  let copied = 0
  let valid = true
  // Decode CSS identifiers before matching, so legacy suffixes such as red\9 cannot match red.
  tokenize(source, (type, start, end) => {
    if (type !== tokenTypes.Ident && type !== tokenTypes.Function && type !== tokenTypes.Hash) {
      return
    }
    const prefix = type === tokenTypes.Hash ? '#' : ''
    const suffix = type === tokenTypes.Function ? '(' : ''
    const raw = source.slice(start + prefix.length, end - suffix.length)
    if (!raw.includes('\\')) {
      return
    }
    const decoded = ident.decode(raw)
    const invalid = prefix ? /[^0-9a-f]/i : /[^a-z0-9-]/i
    if (!decoded || invalid.test(decoded) || (!prefix && !/^(?:[a-z]|-[a-z-])/i.test(decoded))) {
      valid = false
      return
    }
    normalized += source.slice(copied, start) + prefix + decoded + suffix
    copied = end
  })
  return valid ? normalized + source.slice(copied) : undefined
}

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

/**
 * Checks that each shadow layer has a nonnegative blur radius.
 *
 * Offsets and spread may be negative.
 */
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
 * Parses a known base token into a standalone CSS value.
 *
 * Normalizes whitespace, comments and standalone zero lengths. Unknown names, invalid syntax,
 * formulas and references throw TypeError. Consumers own font resources and style application.
 */
export function parseTokenValue(name: TokenName, input: unknown): string {
  if (!Object.hasOwn(tokens, name)) {
    throw new TypeError('Unknown appearance token')
  }
  if (typeof input !== 'string') {
    throw new TypeError(`Invalid value for appearance token ${name}`)
  }

  const kind = tokens[name]
  const syntax = syntaxes[kind]
  const source =
    (kind === 'color' || kind === 'shadow') && input.includes('\\')
      ? decodeColorTokens(input)
      : input
  // Match the tokens first: parsing alone can repair incomplete CSS functions.
  if (source === undefined || lexer.match(syntax, source).error) {
    throw new TypeError(`Invalid value for appearance token ${name}`)
  }

  let ast: CssNode
  try {
    ast = parse(source, { context: 'value' })
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

  // CSS math needs a dimension even where the token grammar accepts a unitless zero.
  const literal = ast.children.first
  if (
    literal?.type === 'Number' &&
    literal === ast.children.last &&
    Number(literal.value) === 0 &&
    lexer.match(syntax, ast).isType(literal, 'length')
  ) {
    return '0px'
  }

  return generate(ast)
}

/**
 * Parses all base tokens into a new frozen appearance branch.
 *
 * Missing or extra keys and invalid CSS values throw TypeError. The input is preserved, and a
 * failed parse delivers no partial branch.
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
