/** @fileoverview Validates and expands native scanner clue rules inside a caller-owned bounded execution unit. */

import * as v from 'valibot'
import { nonemptyText, parseValue, id, text } from '../validation'
import { inspectTextPattern, parseTextTemplate } from '../text-rules'
import type { NonEmptyArray } from '../operations'
import type { WorkClues } from '../metadata/fields'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'

const dateOutput = v.pipe(
  v.strictObject({
    year: v.exactOptional(nonemptyText),
    month: v.exactOptional(nonemptyText),
    day: v.exactOptional(nonemptyText),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

const identityOutput = v.strictObject({ source: nonemptyText, sourceId: nonemptyText })

const outputSchema = v.pipe(
  v.strictObject({
    name: v.exactOptional(nonemptyText),
    originalName: v.exactOptional(nonemptyText),
    releaseDate: v.exactOptional(dateOutput),
    externalIdentities: v.exactOptional(v.tupleWithRest([identityOutput], identityOutput)),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

/** Structure-only decoding does not compile user patterns; saving/execution must also use the full isolated validator. */
export function parseClueExtractionRuleShape(input: unknown): ClueExtractionRule {
  return parseValue(
    v.strictObject({
      id,
      name: nonemptyText,
      enabled: v.boolean(),
      input: v.picklist(['baseName', 'relativePath']),
      pattern: text,
      ignoreCase: v.boolean(),
      output: outputSchema,
    }),
    input,
    'Invalid clue extraction rule',
  )
}

/** Compile and validate all templates, including disabled rules, only within the host's terminable execution unit. */
export function parseClueExtractionRule(input: unknown): ClueExtractionRule {
  const rule = parseClueExtractionRuleShape(input)
  const pattern = inspectTextPattern(rule.pattern, rule.ignoreCase)
  const templates = [
    rule.output.name,
    rule.output.originalName,
    ...Object.values(rule.output.releaseDate ?? {}),
    ...(rule.output.externalIdentities ?? []).flatMap((identity) => [
      identity.source,
      identity.sourceId,
    ]),
  ]
  for (const template of templates) {
    if (template !== undefined) {
      parseTextTemplate(template, pattern.captureNames)
    }
  }

  return rule
}

/** Templates only target root-work clues; no file rename, local ID, private provider setting or arbitrary object path is permitted. */
export interface ClueExtractionOutput {
  readonly name?: string
  readonly originalName?: string
  readonly releaseDate?: { readonly year?: string; readonly month?: string; readonly day?: string }
  readonly externalIdentities?: NonEmptyArray<{
    readonly source: string
    readonly sourceId: string
  }>
}

export interface ClueExtractionRule {
  readonly id: string
  readonly name: string
  readonly enabled: boolean

  readonly input: 'baseName' | 'relativePath'
  readonly pattern: string
  readonly ignoreCase: boolean

  readonly output: ClueExtractionOutput
}

export interface ClueExtractionResult {
  readonly clues: WorkClues
  readonly ruleId: string | null
  readonly captures: Readonly<Record<string, string>>
}

export interface ClueExtractionPreset {
  readonly id: string
  readonly name: LocalizedText
  readonly description: LocalizedText
  readonly rule: Omit<ClueExtractionRule, 'id' | 'name'>
}
