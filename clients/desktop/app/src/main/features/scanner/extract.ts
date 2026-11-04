/** @fileoverview Interprets ordered clue rules once against the original scanner input. */

import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { expandTextTemplate, matchTextPattern } from '../../infrastructure/text-patterns'
import type {
  ClueExtractionOutput,
  ClueExtractionRule,
  ClueExtractionResult,
} from '@kisaki3/desktop-contracts/scanner'
import type { WorkClues } from '@kisaki3/desktop-contracts/metadata'
import { parsePartialDate } from '@kisaki3/desktop-contracts/date'
import type { ExternalIdentity } from '@kisaki3/desktop-contracts/library'
import { parseExternalIdentity } from '@kisaki3/desktop-contracts/library'
import { parseIdentificationClues } from '@kisaki3/desktop-contracts/metadata'
import { inspectTextPattern } from '@kisaki3/desktop-contracts/text-rules'

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
