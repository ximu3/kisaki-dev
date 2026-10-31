/** @fileoverview Owns finite capture templates; user regular expressions are compiled and run only by the isolated owner. */

import * as v from 'valibot'
import { invalidInput } from './errors'
import { nonemptyStringSchema } from './validation'

/** A parsed template has only literal text and named-capture references, with no evaluation or fallback syntax. */
export type TextTemplatePart =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'capture'; readonly name: string }
export type NamedCaptures = Readonly<Record<string, string | undefined>>

/** Parse $<name> and $$ without compiling or executing a user regular expression. */
export function parseTextTemplate(template: string): readonly TextTemplatePart[] {
  const parts: TextTemplatePart[] = []
  let text = ''
  for (let index = 0; index < template.length; index += 1) {
    const character = template[index]!
    if (character !== '$') {
      text += character
      continue
    }
    const next = template[index + 1]
    if (next === '$') {
      text += '$'
      index += 1
      continue
    }
    if (next !== '<') {
      return invalidInput('Invalid capture template syntax.')
    }
    const end = template.indexOf('>', index + 2)
    if (end < 0 || end === index + 2) {
      return invalidInput('Invalid named capture reference.')
    }
    if (text) {
      parts.push({ type: 'text', value: text })
      text = ''
    }
    parts.push({ type: 'capture', name: template.slice(index + 2, end) })
    index = end
  }
  if (text) {
    parts.push({ type: 'text', value: text })
  }
  return parts
}

export const textTemplateSchema = v.pipe(
  nonemptyStringSchema,
  v.check((template) => {
    try {
      parseTextTemplate(template)
      return true
    } catch {
      return false
    }
  }),
)

/** Check references against names obtained from the actual isolated pattern analysis, including disabled rules. */
export function validateTemplateReferences(template: string, names: ReadonlySet<string>): void {
  for (const part of parseTextTemplate(template)) {
    if (part.type === 'capture' && !names.has(part.name)) {
      invalidInput('A template refers to an undeclared capture group.')
    }
  }
}

/** Missing captures suppress the whole field; an actually captured empty string remains a real value. */
export function expandTextTemplate(template: string, captures: NamedCaptures): string | undefined {
  let output = ''
  for (const part of parseTextTemplate(template)) {
    if (part.type === 'text') {
      output += part.value
      continue
    }
    if (!Object.hasOwn(captures, part.name)) {
      return invalidInput('A template refers to an undeclared capture group.')
    }
    const captured = captures[part.name]
    if (captured === undefined) {
      return undefined
    }
    output += captured
  }
  return output
}
