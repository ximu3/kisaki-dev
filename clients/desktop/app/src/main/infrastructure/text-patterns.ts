/** @fileoverview Executes complete text matches and expands declared capture templates. */

import { parseTextTemplate } from '@kisaki3/desktop-contracts/text-rules'
import type { TextPattern } from '@kisaki3/desktop-contracts/text-rules'

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
