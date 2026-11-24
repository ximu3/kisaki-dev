import { RegExpParser, visitRegExpAST } from '@eslint-community/regexpp'
import { DesktopError } from './errors'

export interface TextPattern {
  readonly source: string
  readonly flags: 'u' | 'iu'
  readonly captureNames: readonly string[]
}

export type TextTemplatePart =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'capture'; readonly name: string }

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

    const source = `^(?:${pattern})$`
    const flags = ignoreCase ? 'iu' : 'u'
    new RegExp(source, flags)

    return { source, flags, captureNames: [...names] }
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid full-string regular expression', { cause })
  }
}

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
