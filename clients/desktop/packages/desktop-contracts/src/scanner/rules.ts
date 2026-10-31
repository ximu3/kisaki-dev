/** @fileoverview Defines scanner rule values and pure clue expansion after isolated full-string matching. */

import * as v from 'valibot'
import { parsePartialDate, type PartialDate } from '../date'
import { invalidInput } from '../errors'
import {
  externalIdentityKey,
  parseExternalIdentity,
  type ExternalIdentity,
} from '../library/identity'
import type { WorkClues } from '../metadata/identification'
import { objectSchema } from '../schema'
import {
  expandTextTemplate,
  textTemplateSchema,
  validateTemplateReferences,
  type NamedCaptures,
} from '../text-rules'
import { nonemptyStringSchema, parseContract } from '../validation'

/** Fixed output targets; each string is a literal/capture template, never an arbitrary property path. */
export interface ClueOutput {
  readonly name?: string
  readonly originalName?: string
  readonly releaseDate?: { readonly year?: string; readonly month?: string; readonly day?: string }
  readonly externalIdentities?: readonly { readonly source: string; readonly sourceId: string }[]
}
/** The first full match owns the interpretation; a bad output is not permission to try another rule. */
export interface ClueExtractionRule {
  readonly id: string
  readonly name: string
  readonly enabled: boolean
  readonly input: 'baseName' | 'relativePath'
  readonly pattern: string
  readonly ignoreCase: boolean
  readonly output: ClueOutput
}
const dateOutput = v.pipe(
  objectSchema({
    year: v.exactOptional(textTemplateSchema),
    month: v.exactOptional(textTemplateSchema),
    day: v.exactOptional(textTemplateSchema),
  }),
  v.check((value) => Object.keys(value).length > 0),
)
const outputSchema = v.pipe(
  objectSchema({
    name: v.exactOptional(textTemplateSchema),
    originalName: v.exactOptional(textTemplateSchema),
    releaseDate: v.exactOptional(dateOutput),
    externalIdentities: v.exactOptional(
      v.pipe(
        v.array(objectSchema({ source: textTemplateSchema, sourceId: textTemplateSchema })),
        v.minLength(1),
        v.readonly(),
      ),
    ),
  }),
  v.check((value) => Object.keys(value).length > 0),
)
export const clueExtractionRuleSchema = objectSchema({
  id: nonemptyStringSchema,
  name: nonemptyStringSchema,
  enabled: v.boolean(),
  input: v.picklist(['baseName', 'relativePath']),
  pattern: v.string(),
  ignoreCase: v.boolean(),
  output: outputSchema,
})

/** Parse structural/template syntax; saving additionally requires bounded isolated pattern compilation and group validation. */
export function parseClueExtractionRule(input: unknown): ClueExtractionRule {
  return parseContract(clueExtractionRuleSchema, input, 'clue extraction rule')
}

/** Validate every configured template against actual pattern declarations, without evaluating the pattern here. */
export function validateClueOutputReferences(output: ClueOutput, names: ReadonlySet<string>): void {
  for (const template of [
    output.name,
    output.originalName,
    ...Object.values(output.releaseDate ?? {}),
    ...(output.externalIdentities ?? []).flatMap((identity) => [
      identity.source,
      identity.sourceId,
    ]),
  ]) {
    if (template !== undefined) {
      validateTemplateReferences(template, names)
    }
  }
}

/** Expand an already matched rule. Missing groups remain missing; incomplete identities and empty output fail as one candidate. */
export function expandClueOutput(output: ClueOutput, captures: NamedCaptures): WorkClues {
  const name = expandName(output.name, captures)
  const originalName = expandName(output.originalName, captures)
  let releaseDate: PartialDate | undefined
  if (output.releaseDate) {
    const values: { year?: number; month?: number; day?: number } = {}
    for (const key of ['year', 'month', 'day'] as const) {
      const template = output.releaseDate[key]
      const text =
        template === undefined ? undefined : expandTextTemplate(template, captures)?.trim()
      if (text === undefined) {
        continue
      }
      if (!(key === 'year' ? /^[+-]?[0-9]+$/ : /^[0-9]+$/).test(text)) {
        return invalidInput('A date template produced an invalid integer.')
      }
      const exact = BigInt(text)
      if (exact < BigInt(Number.MIN_SAFE_INTEGER) || exact > BigInt(Number.MAX_SAFE_INTEGER)) {
        return invalidInput('A date template produced an unsafe integer.')
      }
      values[key] = Number(exact)
    }
    if (Object.keys(values).length) {
      releaseDate = parsePartialDate(values)
    }
  }
  const identities = new Map<string, ExternalIdentity>()
  for (const identity of output.externalIdentities ?? []) {
    const source = expandTextTemplate(identity.source, captures)
    const sourceId = expandTextTemplate(identity.sourceId, captures)
    if (source === undefined && sourceId === undefined) {
      continue
    }
    if (source === undefined || sourceId === undefined) {
      return invalidInput('A source identity template produced only one identity component.')
    }
    const value = parseExternalIdentity({ source, sourceId })
    identities.set(externalIdentityKey(value), value)
  }
  if (
    name === undefined &&
    originalName === undefined &&
    releaseDate === undefined &&
    identities.size === 0
  ) {
    return invalidInput('A matched clue rule produced no usable clue.')
  }
  return {
    ...(name === undefined ? {} : { name }),
    ...(originalName === undefined ? {} : { originalName }),
    ...(releaseDate === undefined ? {} : { releaseDate }),
    ...(identities.size === 0 ? {} : { externalIdentities: [...identities.values()] }),
  }
}

function expandName(template: string | undefined, captures: NamedCaptures): string | undefined {
  if (template === undefined) {
    return undefined
  }
  const value = expandTextTemplate(template, captures)
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return invalidInput('A name template produced only whitespace.')
  }
  return trimmed
}
