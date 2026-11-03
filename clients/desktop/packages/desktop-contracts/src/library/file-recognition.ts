/** @fileoverview Defines complete per-medium filename rules and their pure output semantics for isolated execution. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import type { CallOptions, NonEmptyArray, StoredDefinition } from '../operations'
import type { EntryRef } from './catalog'
import type { ReorderInput } from './ordering'
import {
  id,
  integer,
  nonemptyText,
  optionalFields,
  parseValue,
  text,
  unique,
  validateExpectedKeys,
} from '../validation'
import { inspectTextPattern, parseTextTemplate } from '../text-rules'
import { episodeTypeSchema, extraTypeSchema } from './parts'
import type { AnimeEpisodeType, AnimeExtraType } from './catalog'

/** Only actual file-bearing work types own recognition profiles. */
export type FileWorkType = 'anime' | 'comic' | 'novel'
/** Offset is a signed safe integer subtracted from the integer portion after template expansion. */
export interface FileNumberValue {
  readonly value: string
  readonly offset: number
}
export type FileNumberOutput =
  | ({ readonly kind: 'single' } & FileNumberValue)
  | {
      readonly kind: 'range'
      readonly start: string
      readonly end: string
      readonly offset: number
    }
export type NumberedPartOutput =
  | { readonly number: FileNumberOutput; readonly name?: string }
  | { readonly number?: FileNumberOutput; readonly name: string }
export type ComicVolumeScopeOutput =
  | { readonly number: FileNumberValue; readonly name?: string }
  | { readonly number?: FileNumberValue; readonly name: string }
export type AnimeFileTarget =
  | (NumberedPartOutput & {
      readonly kind: 'episode'
      readonly episodeType?: AnimeEpisodeType | null
    })
  | { readonly kind: 'extra'; readonly name: string; readonly extraType?: AnimeExtraType | null }
export type ComicFileTarget =
  | (NumberedPartOutput & { readonly kind: 'volume' })
  | ({ readonly kind: 'chapter'; readonly name?: string } & (
      | {
          readonly number: FileNumberOutput
          readonly numberBasis: 'work'
          readonly volume?: ComicVolumeScopeOutput
        }
      | {
          readonly number: FileNumberOutput
          readonly numberBasis: 'volume'
          readonly volume: ComicVolumeScopeOutput
        }
      | {
          readonly number?: never
          readonly numberBasis?: never
          readonly name: string
          readonly volume?: ComicVolumeScopeOutput
        }
    ))
export type NovelFileTarget = NumberedPartOutput & { readonly kind: 'volume' }
export interface FileTargetByType {
  readonly anime: AnimeFileTarget
  readonly comic: ComicFileTarget
  readonly novel: NovelFileTarget
}

/** The first enabled full match owns the entire interpretation; targets are jointly required, not fallback candidates. */
export interface FileRecognitionRule<TTarget> {
  readonly id: string
  readonly name: string
  readonly enabled: boolean
  readonly input: 'baseName' | 'path'
  readonly pattern: string
  readonly ignoreCase: boolean
  readonly output: { readonly targets: NonEmptyArray<TTarget> }
}
export interface FileRecognitionDefinition<T extends FileWorkType = FileWorkType> {
  readonly rules: readonly FileRecognitionRule<FileTargetByType[T]>[]
}
/** Definition changes affect later interpretation; a broken selected profile never means fallback to builtin recognition. */
export interface FileRecognitionProfile<T extends FileWorkType = FileWorkType> {
  readonly id: string
  readonly workType: T
  readonly name: string
  readonly description: string | null
  readonly definition: StoredDefinition<FileRecognitionDefinition<T>>
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}
export interface FileRecognitionProfileFields<T extends FileWorkType> {
  readonly name: string
  readonly description: string | null
  readonly definition: FileRecognitionDefinition<T>
}
export interface FileRecognitionPreset<T extends FileWorkType> {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly definition: FileRecognitionDefinition<T>
}
/** Shared profiles are independently managed. Referenced profiles cannot be deleted or silently replaced. */
export interface FileRecognitionProfilesApi<T extends FileWorkType> {
  list(
    call?: CallOptions,
  ): Promise<readonly Pick<FileRecognitionProfile<T>, 'id' | 'workType' | 'name' | 'description'>[]>
  get(id: string, call?: CallOptions): Promise<FileRecognitionProfile<T> | null>
  create(
    input: FileRecognitionProfileFields<T>,
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<T>>
  update(
    id: string,
    input: {
      readonly changes: Partial<FileRecognitionProfileFields<T>>
      readonly expected?: Partial<FileRecognitionProfileFields<T>>
    },
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<T>>
  delete(id: string, call?: CallOptions): Promise<void>
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>
  references(
    id: string,
    call?: CallOptions,
  ): Promise<
    readonly { readonly work: EntryRef<T>; readonly directoryId: string; readonly path: string }[]
  >
  listPresets(call?: CallOptions): Promise<readonly FileRecognitionPreset<T>[]>
}

const numberValue = v.strictObject({ value: text, offset: integer })
const numberOutput = v.variant('kind', [
  v.strictObject({ kind: v.literal('single'), ...numberValue.entries }),
  v.strictObject({ kind: v.literal('range'), start: text, end: text, offset: integer }),
])
const numbered = { number: v.exactOptional(numberOutput), name: v.exactOptional(text) }
const volumeScope = v.pipe(
  v.strictObject({ number: v.exactOptional(numberValue), name: v.exactOptional(text) }),
  v.check((value) => value.number !== undefined || value.name !== undefined),
)
const volume = v.pipe(
  v.strictObject({ kind: v.literal('volume'), ...numbered }),
  v.check((value) => value.number !== undefined || value.name !== undefined),
)
const targetSchemas = {
  anime: v.union([
    v.pipe(
      v.strictObject({
        kind: v.literal('episode'),
        ...numbered,
        episodeType: v.exactOptional(v.nullable(episodeTypeSchema)),
      }),
      v.check((value) => value.number !== undefined || value.name !== undefined),
    ),
    v.strictObject({
      kind: v.literal('extra'),
      name: text,
      extraType: v.exactOptional(v.nullable(extraTypeSchema)),
    }),
  ]),
  comic: v.union([
    volume,
    v.pipe(
      v.strictObject({
        kind: v.literal('chapter'),
        ...numbered,
        numberBasis: v.exactOptional(v.picklist(['work', 'volume'])),
        volume: v.exactOptional(volumeScope),
      }),
      v.check(
        (value) =>
          (value.number !== undefined || value.name !== undefined) &&
          (value.number === undefined
            ? value.numberBasis === undefined
            : value.numberBasis !== undefined) &&
          (value.numberBasis !== 'volume' || value.volume !== undefined),
      ),
    ),
  ]),
  novel: volume,
}

/** Parse the medium's fixed output structure. Templates are checked against the owning rule's captures separately. */
export function parseFileTarget<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileTargetByType[T] {
  return parseValue(
    targetSchemas[workType],
    input,
    'Invalid file recognition target',
  ) as FileTargetByType[T]
}

function targetTemplates(
  target: AnimeFileTarget | ComicFileTarget | NovelFileTarget,
): readonly string[] {
  const templates: string[] = []
  if (target.name !== undefined) {
    templates.push(target.name)
  }
  if ('number' in target && target.number) {
    if (target.number.kind === 'single') {
      templates.push(target.number.value)
    } else {
      templates.push(target.number.start, target.number.end)
    }
  }
  if (target.kind === 'chapter' && target.volume) {
    if (target.volume.name !== undefined) {
      templates.push(target.volume.name)
    }
    if (target.volume.number) {
      templates.push(target.volume.number.value)
    }
  }
  return templates
}

/**
 * Validate every rule, including disabled ones, in a bounded terminable unit because patterns are compiled.
 * An empty rule list is valid; invalid selected definitions never become an empty list.
 */
export function parseFileRecognitionDefinition<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileRecognitionDefinition<T> {
  const value = parseFileRecognitionDefinitionShape(workType, input)
  for (const rule of value.rules) {
    const pattern = inspectTextPattern(rule.pattern, rule.ignoreCase)
    for (const target of rule.output.targets) {
      for (const template of targetTemplates(target)) {
        parseTextTemplate(template, pattern.captureNames)
      }
    }
  }
  return value
}

/** Decode the closed value without compiling patterns; codecs/history reads cannot substitute this for isolated execution validation. */
export function parseFileRecognitionDefinitionShape<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileRecognitionDefinition<T> {
  const target = v.pipe(
    v.unknown(),
    v.transform((value) => parseFileTarget(workType, value)),
  )
  const rule = v.strictObject({
    id,
    name: nonemptyText,
    enabled: v.boolean(),
    input: v.picklist(['baseName', 'path']),
    pattern: text,
    ignoreCase: v.boolean(),
    output: v.strictObject({ targets: v.tupleWithRest([target], target) }),
  })
  const value = parseValue(
    v.strictObject({
      rules: v.pipe(
        v.array(rule),
        v.check((rules) => unique(rules, (rule) => rule.id)),
      ),
    }),
    input,
    'Invalid file recognition definition',
  )
  return value
}

/** Validate a profile's actual changed fields, compiling a submitted definition within the caller's isolated unit. */
export function parseFileRecognitionProfileUpdate<T extends FileWorkType>(
  workType: T,
  input: unknown,
): {
  readonly changes: Partial<FileRecognitionProfileFields<T>>
  readonly expected?: Partial<FileRecognitionProfileFields<T>>
} {
  const fields = v.strictObject(
    optionalFields({
      name: nonemptyText,
      description: v.nullable(text),
      definition: v.pipe(
        v.unknown(),
        v.transform((value) => parseFileRecognitionDefinition(workType, value)),
      ),
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Integer-only labels lose leading zeros for matching; decimal, textual and non-ASCII labels retain exact trimmed spelling. */
export function fileNumberKey(value: string): string {
  const trimmed = value.trim()
  return /^[0-9]+$/.test(trimmed) ? trimmed.replace(/^0+(?=[0-9])/, '') : trimmed
}
/** Only the integer portion is shifted. Offset zero preserves original text, including decimal zeros and whitespace. */
export function applyFileNumberOffset(value: string, offset: number): string {
  parseValue(integer, offset, 'Invalid file number offset')
  if (!value.trim()) {
    throw new DesktopError('InvalidInput', 'A file number output must not be blank')
  }
  if (offset === 0) {
    return value
  }
  const match = /^([0-9]+)(\.[0-9]+)?$/.exec(value.trim())
  if (!match) {
    throw new DesktopError(
      'InvalidInput',
      'Nonzero offsets require an integer or dotted numeric label',
    )
  }
  const shifted = BigInt(match[1]!) - BigInt(offset)
  if (shifted < 0n) {
    throw new DesktopError('InvalidInput', 'File number offset produced a negative value')
  }
  return `${shifted}${match[2] ?? ''}`
}
/** Expand an explicit integer interval only after its exact size fits the caller's actual remaining work budget. */
export function expandFileNumberRange(
  start: string,
  end: string,
  capacity: number,
): readonly string[] {
  parseValue(v.pipe(integer, v.minValue(0)), capacity)
  if (!/^[0-9]+$/.test(start.trim()) || !/^[0-9]+$/.test(end.trim())) {
    throw new DesktopError('InvalidInput', 'File number ranges require integer endpoints')
  }
  const first = BigInt(start.trim())
  const last = BigInt(end.trim())
  if (last < first) {
    throw new DesktopError('InvalidInput', 'File number range is reversed')
  }
  if (last - first + 1n > BigInt(capacity)) {
    throw new DesktopError('ResourceLimit', 'File number range exceeds the available work budget')
  }
  const values: string[] = []
  for (let value = first; value <= last; value += 1n) {
    values.push(String(value))
  }
  return values
}
