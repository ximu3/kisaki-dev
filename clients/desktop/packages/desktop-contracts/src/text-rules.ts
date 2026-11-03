/** @fileoverview Provides pure full-string regex and replacement-template rules for bounded isolated execution units. */

import { RegExpParser, visitRegExpAST } from '@eslint-community/regexpp'
import { DesktopError } from './errors'

/** Whole-string source and canonical named captures; only u and optional i flags are admitted. */
export interface TextPattern {
  readonly source: string
  readonly flags: 'u' | 'iu'
  readonly captureNames: readonly string[]
}
/** Templates contain literal text or named captures, never executable expressions. */
export type TextTemplatePart =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'capture'; readonly name: string }

/**
 * Parse and compile a user pattern only inside a terminable unit whose budget covers compilation,
 * matching and output expansion. A Promise timeout around main-thread execution is insufficient.
 */
export function inspectTextPattern(pattern: string, ignoreCase: boolean): TextPattern {
  try {
    const parser = new RegExpParser({ ecmaVersion: 2025 })
    const ast = parser.parsePattern(pattern, 0, pattern.length, { unicode: true })
    const names = new Set<string>()
    visitRegExpAST(ast, {
      onCapturingGroupEnter(group) {
        if (group.name !== null) {
          names.add(group.name)
        }
      },
    })
    const source = `^(?:${pattern})(?![\\s\\S])`
    const flags = ignoreCase ? 'iu' : 'u'
    new RegExp(source, flags)
    return { source, flags, captureNames: [...names] }
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid full-string regular expression', { cause })
  }
}

/** Parse literal text, $$ and $<name>; supplied captureNames also reject undeclared references. */
export function parseTextTemplate(
  template: string,
  captureNames?: readonly string[],
): readonly TextTemplatePart[] {
  const parts: TextTemplatePart[] = []
  let literal = ''
  function flush(): void {
    if (literal) {
      parts.push({ type: 'text', value: literal })
      literal = ''
    }
  }
  for (let index = 0; index < template.length;) {
    const character = template[index]!
    if (character !== '$') {
      literal += character
      index += 1
      continue
    }
    if (template[index + 1] === '$') {
      literal += '$'
      index += 2
      continue
    }
    const end = template.indexOf('>', index + 2)
    if (template[index + 1] !== '<' || end < 0) {
      throw new DesktopError('InvalidInput', 'Invalid replacement template')
    }
    const name = template.slice(index + 2, end)
    if (!name || (captureNames && !captureNames.includes(name))) {
      throw new DesktopError('InvalidInput', 'Unknown named capture in replacement template')
    }
    flush()
    parts.push({ type: 'capture', name })
    index = end + 1
  }
  flush()
  return parts
}

/** An unmatched capture omits the whole field; a captured empty string remains an actual value. */
export function expandTextTemplate(
  template: string,
  captures: Readonly<Record<string, string>>,
): string | undefined {
  let result = ''
  for (const part of parseTextTemplate(template)) {
    if (part.type === 'text') {
      result += part.value
      continue
    }
    if (!Object.hasOwn(captures, part.name)) {
      return undefined
    }
    result += captures[part.name]!
  }
  return result
}

/**
 * Match in the same bounded isolated unit as compilation. Alternatives may backtrack to cover the complete input.
 * Null means no match; unmatched groups are omitted, while captured empty strings are preserved.
 */
export function matchTextPattern(
  pattern: TextPattern,
  input: string,
): Readonly<Record<string, string>> | null {
  const match = new RegExp(pattern.source, pattern.flags).exec(input)
  if (!match) {
    return null
  }
  return Object.fromEntries(
    Object.entries(match.groups ?? {}).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
}
