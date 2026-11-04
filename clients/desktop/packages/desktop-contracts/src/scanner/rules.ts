/** @fileoverview Validates and expands native scanner clue rules inside a caller-owned bounded execution unit. */

import * as v from 'valibot'
import { parsePartialDate } from '../date'
import { DesktopError } from '../errors'
import { scannerMessages } from '../i18n/en/scanner'
import { id, nonemptyText, parseValue, text } from '../validation'
import { parseExternalIdentity } from '../library/catalog'
import type { ExternalIdentity } from '../library/catalog'
import {
  expandTextTemplate,
  inspectTextPattern,
  matchTextPattern,
  parseTextTemplate,
} from '../text-rules'
import { parseIdentificationClues } from '../metadata/fields'
import type { WorkClues } from '../metadata/fields'
import type {
  ClueExtractionOutput,
  ClueExtractionPreset,
  ClueExtractionResult,
  ClueExtractionRule,
} from './values'

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

function dateNumber(value: string, signed: boolean): number {
  const text = value.trim()
  if (!(signed ? /^[+-]?[0-9]+$/ : /^[0-9]+$/).test(text)) {
    throw new DesktopError('InvalidInput', 'A date output must be a complete decimal integer')
  }

  const integer = BigInt(text)
  if (integer < BigInt(Number.MIN_SAFE_INTEGER) || integer > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new DesktopError('InvalidInput', 'Date output is outside the safe integer range')
  }

  return Number(integer)
}

function nameOutput(
  template: string | undefined,
  captures: Readonly<Record<string, string>>,
): string | undefined {
  if (template === undefined) {
    return undefined
  }

  const value = expandTextTemplate(template, captures)
  if (value === undefined) {
    return undefined
  }
  if (!value.trim()) {
    throw new DesktopError('InvalidInput', 'A matched name output must not be blank')
  }

  return value.trim()
}

/** Expand whole fields, preserving missing-capture semantics and full identity pairs, then apply the common clue/date rules. */
export function expandClueExtractionOutput(
  output: ClueExtractionOutput,
  captures: Readonly<Record<string, string>>,
): WorkClues {
  const name = nameOutput(output.name, captures)
  const originalName = nameOutput(output.originalName, captures)

  const date: { year?: number; month?: number; day?: number } = {}
  for (const component of ['year', 'month', 'day'] as const) {
    const template = output.releaseDate?.[component]
    if (template === undefined) {
      continue
    }

    const value = expandTextTemplate(template, captures)
    if (value !== undefined) {
      date[component] = dateNumber(value, component === 'year')
    }
  }

  const releaseDate = Object.keys(date).length > 0 ? parsePartialDate(date) : undefined

  const identities: ExternalIdentity[] = []
  const seen = new Set<string>()
  for (const mapping of output.externalIdentities ?? []) {
    const source = expandTextTemplate(mapping.source, captures)
    const sourceId = expandTextTemplate(mapping.sourceId, captures)
    if (source === undefined && sourceId === undefined) {
      continue
    }
    if (source === undefined || sourceId === undefined) {
      throw new DesktopError(
        'InvalidInput',
        'A matched external identity needs both source and sourceId',
      )
    }

    const identity = parseExternalIdentity({ source, sourceId })
    const key = JSON.stringify([identity.source, identity.sourceId])
    if (!seen.has(key)) {
      seen.add(key)
      identities.push(identity)
    }
  }

  const clues = {
    ...(name === undefined ? {} : { name }),
    ...(originalName === undefined ? {} : { originalName }),
    ...(releaseDate === undefined ? {} : { releaseDate }),
    ...(identities.length > 0 ? { externalIdentities: identities } : {}),
  }
  if (Object.keys(clues).length === 0) {
    throw new DesktopError('InvalidInput', 'The matched rule produced no usable work clues')
  }

  return parseIdentificationClues('game', clues)
}

/**
 * Interpret a validated rule list only in a bounded terminable unit. A matched invalid output throws;
 * only a wholly unmatched list falls back to the original baseName, without chaining rules or recognizers.
 */
export function extractWorkClues(
  rules: readonly ClueExtractionRule[],
  input: { readonly baseName: string; readonly relativePath: string },
): ClueExtractionResult {
  for (const rule of rules) {
    if (!rule.enabled) {
      continue
    }

    const captures = matchTextPattern(
      inspectTextPattern(rule.pattern, rule.ignoreCase),
      input[rule.input],
    )
    if (captures === null) {
      continue
    }

    return { clues: expandClueExtractionOutput(rule.output, captures), ruleId: rule.id, captures }
  }

  return {
    clues: parseIdentificationClues('game', { name: input.baseName }),
    ruleId: null,
    captures: {},
  }
}

/** Return the nine opt-in native templates in catalog order. Consumers assign fresh rule IDs and localized editable names. */
export function getClueExtractionPresets(): readonly ClueExtractionPreset[] {
  const patterns = [
    [
      'bracket-both',
      'bracketBoth',
      String.raw`^(?:(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)[\t\p{Zs}]*)+(?<name>(?![\[【])\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)$`,
    ],
    [
      'multi-bracket-prefix',
      'multiBracketPrefix',
      String.raw`^(?:(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)[\t\p{Zs}]*){2,}(?<name>(?![\[【])\S[^\r\n\u2028\u2029]*)$`,
    ],
    [
      'release-year-suffix',
      'releaseYearSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?=\([0-9]{4}\)$|（[0-9]{4}）$)[(（](?<year>[0-9]{4})[)）]$`,
    ],
    [
      'version-suffix',
      'versionSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)_v[0-9]+(?:\.[0-9]+)*$`,
    ],
    [
      'lang-suffix',
      'languageSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[-_](?:CHS|CHT|JP|EN|KR|SC|TC)$`,
    ],
    [
      'bracket-prefix',
      'bracketPrefix',
      String.raw`^(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)[\t\p{Zs}]*(?<name>\S[^\r\n\u2028\u2029]*)$`,
    ],
    [
      'paren-prefix',
      'parenPrefix',
      String.raw`^(?:\([^()（）\r\n\u2028\u2029]+\)|（[^()（）\r\n\u2028\u2029]+）)[\t\p{Zs}]*(?<name>\S[^\r\n\u2028\u2029]*)$`,
    ],
    [
      'bracket-suffix',
      'bracketSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?:\[[^\[\]【】\r\n\u2028\u2029]+\]|【[^\[\]【】\r\n\u2028\u2029]+】)$`,
    ],
    [
      'paren-suffix',
      'parenSuffix',
      String.raw`^(?<name>\S[^\r\n\u2028\u2029]*?)[\t\p{Zs}]*(?:\([^()（）\r\n\u2028\u2029]+\)|（[^()（）\r\n\u2028\u2029]+）)$`,
    ],
  ] as const

  return patterns.map(([id, label, pattern]) => ({
    id,
    ...scannerMessages.presets[label],
    rule: {
      enabled: true,
      input: 'baseName',
      pattern,
      ignoreCase: id === 'version-suffix' || id === 'lang-suffix',
      output:
        id === 'release-year-suffix'
          ? { name: '$<name>', releaseDate: { year: '$<year>' } }
          : { name: '$<name>' },
    },
  }))
}
