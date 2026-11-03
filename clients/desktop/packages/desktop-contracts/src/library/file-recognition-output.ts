/** @fileoverview Expands one matched file rule into complete part conditions without consulting catalog state. */

import { DesktopError } from '../errors'
import type { NonEmptyArray } from '../operations'
import { expandTextTemplate, inspectTextPattern, matchTextPattern } from '../text-rules'
import type { AnimeEpisodeType, AnimeExtraType } from './catalog'
import { applyFileNumberOffset } from './file-recognition'
import type {
  AnimeFileTarget,
  ComicFileTarget,
  ComicVolumeScopeOutput,
  FileNumberOutput,
  FileRecognitionDefinition,
  FileTargetByType,
  FileWorkType,
  NovelFileTarget,
} from './file-recognition'

/** Already expanded labels; the matcher never reinterprets templates or applies the offset again. */
export type FileNumberCondition =
  | { readonly kind: 'single'; readonly value: string }
  | { readonly kind: 'range'; readonly start: string; readonly end: string }

export type NumberedPartCondition =
  | { readonly number: FileNumberCondition; readonly name?: string }
  | { readonly number?: FileNumberCondition; readonly name: string }

export type ComicVolumeScopeCondition =
  | { readonly number: string; readonly name?: string }
  | { readonly number?: string; readonly name: string }

export interface FileConditionByType {
  readonly anime:
    | (NumberedPartCondition & {
        readonly kind: 'episode'
        readonly episodeType?: AnimeEpisodeType | null
      })
    | { readonly kind: 'extra'; readonly name: string; readonly extraType?: AnimeExtraType | null }

  readonly comic:
    | (NumberedPartCondition & { readonly kind: 'volume' })
    | (NumberedPartCondition & {
        readonly kind: 'chapter'
        readonly numberBasis?: 'work' | 'volume'
        readonly volume?: ComicVolumeScopeCondition
      })

  readonly novel: NumberedPartCondition & { readonly kind: 'volume' }
}

/** A complete match stops interpretation even if later catalog lookup fails; unmatched alone permits builtin recognition. */
export type FileRuleInterpretation<T extends FileWorkType> =
  | { readonly status: 'unmatched' }
  | {
      readonly status: 'matched'
      readonly ruleId: string
      readonly targets: NonEmptyArray<FileConditionByType[T]>
    }

function outputName(
  template: string | undefined,
  captures: Readonly<Record<string, string>>,
): string | undefined {
  if (template === undefined) {
    return undefined
  }

  const expanded = expandTextTemplate(template, captures)
  if (expanded === undefined) {
    return undefined
  }

  const value = expanded.trim()
  if (!value) {
    throw new DesktopError('InvalidInput', 'A matched file rule produced a blank name')
  }

  return value
}

function outputNumber(
  number: FileNumberOutput | undefined,
  captures: Readonly<Record<string, string>>,
): FileNumberCondition | undefined {
  if (!number) {
    return undefined
  }
  if (number.kind === 'single') {
    const value = expandTextTemplate(number.value, captures)
    return value === undefined
      ? undefined
      : { kind: 'single', value: applyFileNumberOffset(value, number.offset) }
  }

  const first = expandTextTemplate(number.start, captures)
  const last = expandTextTemplate(number.end, captures)
  if (first === undefined || last === undefined) {
    throw new DesktopError('InvalidInput', 'A matched range must have both endpoints')
  }

  const start = applyFileNumberOffset(first, number.offset)
  const end = applyFileNumberOffset(last, number.offset)
  if (
    !/^[0-9]+$/.test(start.trim()) ||
    !/^[0-9]+$/.test(end.trim()) ||
    BigInt(start.trim()) > BigInt(end.trim())
  ) {
    throw new DesktopError('InvalidInput', 'A matched range must be a forward integer interval')
  }

  return { kind: 'range', start, end }
}

function numbered(
  target: { readonly number?: FileNumberOutput; readonly name?: string },
  captures: Readonly<Record<string, string>>,
): NumberedPartCondition {
  const number = outputNumber(target.number, captures)
  const name = outputName(target.name, captures)
  if (number) {
    return { number, ...(name === undefined ? {} : { name }) }
  }
  if (name !== undefined) {
    return { name }
  }

  throw new DesktopError('InvalidInput', 'A matched file target needs a number or complete name')
}

function volumeScope(
  target: ComicVolumeScopeOutput,
  captures: Readonly<Record<string, string>>,
): ComicVolumeScopeCondition {
  const expanded = target.number ? expandTextTemplate(target.number.value, captures) : undefined
  const number =
    expanded === undefined ? undefined : applyFileNumberOffset(expanded, target.number!.offset)
  const name = outputName(target.name, captures)
  if (number !== undefined) {
    return { number, ...(name === undefined ? {} : { name }) }
  }
  if (name !== undefined) {
    return { name }
  }

  throw new DesktopError('InvalidInput', 'A declared volume scope cannot disappear after expansion')
}

/** Expand every declared target; a missing or invalid required target rejects the complete interpretation. */
export function expandFileTarget<T extends FileWorkType>(
  target: FileTargetByType[T],
  captures: Readonly<Record<string, string>>,
): FileConditionByType[T] {
  const source: AnimeFileTarget | ComicFileTarget | NovelFileTarget = target
  if (source.kind === 'extra') {
    const name = outputName(source.name, captures)
    if (name === undefined) {
      throw new DesktopError('InvalidInput', 'An extra requires its complete name')
    }

    return {
      kind: 'extra',
      name,
      ...(source.extraType === undefined ? {} : { extraType: source.extraType }),
    } as FileConditionByType[T]
  }

  const fields = numbered(source, captures)
  if (source.kind === 'episode') {
    return {
      kind: 'episode',
      ...fields,
      ...(source.episodeType === undefined ? {} : { episodeType: source.episodeType }),
    } as FileConditionByType[T]
  }
  if (source.kind === 'chapter') {
    const volume = source.volume ? volumeScope(source.volume, captures) : undefined
    return {
      kind: 'chapter',
      ...fields,
      ...(fields.number && source.numberBasis ? { numberBasis: source.numberBasis } : {}),
      ...(volume ? { volume } : {}),
    } as FileConditionByType[T]
  }

  return { kind: 'volume', ...fields } as FileConditionByType[T]
}

/**
 * Evaluate an already validated definition in a terminable execution unit with the host's budget and cancellation.
 * The first enabled full match owns the result; invalid expansion throws and cannot fall through to another rule.
 */
export function interpretFileRules<T extends FileWorkType>(
  definition: FileRecognitionDefinition<T>,
  input: { readonly baseName: string; readonly path: string },
): FileRuleInterpretation<T> {
  for (const rule of definition.rules) {
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

    const [first, ...rest] = rule.output.targets
    return {
      status: 'matched',
      ruleId: rule.id,
      targets: [
        expandFileTarget<T>(first, captures),
        ...rest.map((target) => expandFileTarget<T>(target, captures)),
      ],
    }
  }

  return { status: 'unmatched' }
}
