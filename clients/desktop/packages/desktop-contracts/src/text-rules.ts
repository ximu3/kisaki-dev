/** @fileoverview Provides pure full-string regex and replacement-template rules for bounded isolated execution units. */

import { RegExpParser, visitRegExpAST } from '@eslint-community/regexpp'
import { DesktopError } from './errors'

/** Whole-input regular-expression source, permitted flags and canonical named captures. */
export interface TextPattern {
  readonly source: string
  readonly flags: 'u' | 'iu'
  readonly captureNames: readonly string[]
}

/** Literal text or a named-capture reference in a non-executable replacement template. */
export type TextTemplatePart =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'capture'; readonly name: string }

/**
 * Parses and compiles a user pattern with whole-input anchors and returns its named captures.
 *
 * Callers provide a terminable unit whose budget covers compilation, matching and output expansion.
 * A main-thread Promise timeout cannot enforce that boundary.
 */
export function inspectTextPattern(pattern: string, ignoreCase: boolean): TextPattern {
  try {
    const parser = new RegExpParser({ ecmaVersion: 2025 })
    const ast = parser.parsePattern(pattern, 0, pattern.length, { unicode: true })

    const names = new Set<string>()
    visitRegExpAST(ast, {
      /** Collects named capture identities from the parsed regular-expression syntax. */
      onCapturingGroupEnter(group) {
        if (group.name !== null) {
          names.add(group.name)
        }
      },
    })

    const source = `^(?:${pattern})$`
    const flags = ignoreCase ? 'iu' : 'u'
    new RegExp(source, flags)

    return { source, flags, captureNames: [...names] }
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid full-string regular expression', { cause })
  }
}

/**
 * Parses literal text, escaped dollars and named-capture references.
 *
 * When captureNames is supplied, undeclared references are rejected.
 */
export function parseTextTemplate(
  template: string,
  captureNames?: readonly string[],
): readonly TextTemplatePart[] {
  const parts: TextTemplatePart[] = []
  let literal = ''

  /** Appends accumulated literal text as one template part and clears the buffer. */
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
